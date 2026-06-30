using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;
using ShepherdCare.Api.Services;
using System.Security.Claims;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/spiritual-records")]
    [Authorize]
    public class SpiritualRecordsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IAuditService _audit;

        private static readonly string[] FullAccessRoles = ["SuperAdmin", "Priest", "SeniorPriest"];
        private static readonly string[] ValidTypes = ["Confession", "Communion", "Call", "Mass"];

        public SpiritualRecordsController(AppDbContext db, IAuditService audit)
        {
            _db = db;
            _audit = audit;
        }

        /// <summary>
        /// Returns null for full access (no filter needed), or a set of allowed member IDs,
        /// or an empty set when the caller has no class assignments.
        /// Returns false if the role has no access at all.
        /// </summary>
        private async Task<(bool hasAccess, HashSet<Guid>? allowedMemberIds)> ResolveAccessAsync()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var role   = User.FindFirstValue(ClaimTypes.Role);

            if (!Guid.TryParse(userId, out var currentUserId))
                return (false, null);

            // Priests and admins see everything
            if (FullAccessRoles.Contains(role))
                return (true, null);

            // ServiceLeader — members in their groups' classes
            if (role == "ServiceLeader")
            {
                var groupIds = await _db.Groups
                    .Where(g => g.ServantUserId == currentUserId)
                    .Select(g => g.Id)
                    .ToListAsync();

                var classIds = await _db.Classes
                    .Where(c => c.GroupId.HasValue && groupIds.Contains(c.GroupId.Value))
                    .Select(c => c.Id)
                    .ToListAsync();

                var memberIds = await _db.ClassEnrollments
                    .Where(e => classIds.Contains(e.ClassId))
                    .Select(e => e.MemberId)
                    .ToListAsync();

                return (true, memberIds.ToHashSet());
            }

            // Servant / DataEntry — members in their assigned classes
            if (role == "Servant" || role == "DataEntry")
            {
                var classIds = await _db.Servants
                    .Where(s => s.UserId == currentUserId)
                    .Select(s => s.ClassId)
                    .ToListAsync();

                var memberIds = await _db.ClassEnrollments
                    .Where(e => classIds.Contains(e.ClassId))
                    .Select(e => e.MemberId)
                    .ToListAsync();

                return (true, memberIds.ToHashSet());
            }

            return (false, null);
        }

        /// <summary>GET /api/spiritual-records — paginated, role-filtered</summary>
        [HttpGet]
        public async Task<IActionResult> GetRecent([FromQuery] int page = 1, [FromQuery] int pageSize = 25)
        {
            var (hasAccess, allowedIds) = await ResolveAccessAsync();
            if (!hasAccess) return Forbid();

            var query = allowedIds == null
                ? _db.SpiritualRecords.AsQueryable()
                : _db.SpiritualRecords.Where(r => allowedIds.Contains(r.MemberId));

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.Date)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(r => new
                {
                    r.Id,
                    r.MemberId,
                    MemberName = r.Member != null ? r.Member.FullName : null,
                    r.Type,
                    r.Date,
                    r.Notes,
                    r.CreatedAt,
                    RecordedByName = r.RecordedByUser != null
                        ? r.RecordedByUser.DisplayName ?? r.RecordedByUser.Username
                        : null
                })
                .ToListAsync();

            return Ok(new { items, page, pageSize, totalCount = total });
        }

        /// <summary>GET /api/spiritual-records/by-member/{memberId}</summary>
        [HttpGet("by-member/{memberId}")]
        public async Task<IActionResult> GetByMember(Guid memberId)
        {
            var (hasAccess, allowedIds) = await ResolveAccessAsync();
            if (!hasAccess) return Forbid();

            // Restricted roles may only query members in their scope
            if (allowedIds != null && !allowedIds.Contains(memberId))
                return Forbid();

            var records = await _db.SpiritualRecords
                .Where(r => r.MemberId == memberId)
                .OrderByDescending(r => r.Date)
                .Select(r => new
                {
                    r.Id,
                    r.MemberId,
                    r.Type,
                    r.Date,
                    r.Notes,
                    r.CreatedAt,
                    RecordedByName = r.RecordedByUser != null
                        ? r.RecordedByUser.DisplayName ?? r.RecordedByUser.Username
                        : null
                })
                .ToListAsync();

            return Ok(records);
        }

        /// <summary>POST /api/spiritual-records — log a new record</summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] SpiritualRecordDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userId, out var recordedBy))
                return Unauthorized();

            var (hasAccess, allowedIds) = await ResolveAccessAsync();
            if (!hasAccess) return Forbid();

            // Servants and restricted roles can only add records for their scope
            if (allowedIds != null && !allowedIds.Contains(dto.MemberId))
                return Forbid();

            if (!ValidTypes.Contains(dto.Type))
                return BadRequest("Type must be Confession, Communion, Mass, or Call.");

            var member = await _db.FamilyMembers.FindAsync(dto.MemberId);
            if (member == null) return NotFound("Member not found.");

            var record = new SpiritualRecord
            {
                Id = Guid.NewGuid(),
                MemberId = dto.MemberId,
                Type = dto.Type,
                Date = dto.Date,
                Notes = dto.Notes,
                RecordedBy = recordedBy,
                CreatedAt = DateTime.Now
            };
            _db.SpiritualRecords.Add(record);

            // Keep cached dates in sync
            switch (dto.Type)
            {
                case "Confession":
                    if (member.LastConfessionDate == null || dto.Date > member.LastConfessionDate)
                        member.LastConfessionDate = dto.Date;
                    break;
                case "Communion":
                    if (member.LastCommunionDate == null || dto.Date > member.LastCommunionDate)
                        member.LastCommunionDate = dto.Date;
                    break;
                case "Call":
                    if (member.LastCallDate == null || dto.Date > member.LastCallDate)
                        member.LastCallDate = dto.Date;
                    break;
            }

            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog
            {
                Action = "AddSpiritualRecord",
                PerformedBy = User.Identity?.Name ?? "system",
                Entity = "SpiritualRecord",
                EntityId = record.Id.ToString(),
                Details = $"{dto.Type} for member {member.FullName} on {dto.Date:yyyy-MM-dd}"
            });

            return Ok(new
            {
                record.Id,
                record.MemberId,
                record.Type,
                record.Date,
                record.Notes,
                record.CreatedAt,
                updatedMemberDate = dto.Type switch
                {
                    "Confession" => member.LastConfessionDate,
                    "Communion"  => member.LastCommunionDate,
                    "Call"       => member.LastCallDate,
                    _            => (DateTime?)null
                }
            });
        }

        /// <summary>DELETE /api/spiritual-records/{id} — priests and admins only</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            if (!FullAccessRoles.Contains(role))
                return Forbid();

            var record = await _db.SpiritualRecords.FindAsync(id);
            if (record == null) return NotFound();

            var memberId = record.MemberId;
            var type = record.Type;
            _db.SpiritualRecords.Remove(record);
            await _db.SaveChangesAsync();

            // Recalculate cached date from remaining records of this type
            var member = await _db.FamilyMembers.FindAsync(memberId);
            if (member != null)
            {
                var latest = await _db.SpiritualRecords
                    .Where(r => r.MemberId == memberId && r.Type == type)
                    .OrderByDescending(r => r.Date)
                    .Select(r => (DateTime?)r.Date)
                    .FirstOrDefaultAsync();

                switch (type)
                {
                    case "Confession": member.LastConfessionDate = latest; break;
                    case "Communion":  member.LastCommunionDate  = latest; break;
                    case "Call":       member.LastCallDate        = latest; break;
                }
                await _db.SaveChangesAsync();
            }

            return NoContent();
        }
    }

    public class SpiritualRecordDto
    {
        public Guid MemberId { get; set; }
        public string Type { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string? Notes { get; set; }
    }
}
