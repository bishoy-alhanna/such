using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;
using System.Security.Claims;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Authorize]
    public class MilestonesController : ControllerBase
    {
        private static readonly string[] ValidTypes =
        [
            "Baptism", "Chrismation", "FirstCommunion", "FirstConfession",
            "Wedding", "Ordination", "Tonsure", "Consecration", "Other"
        ];

        // Roles that can write milestones (servants may only read)
        private static readonly string[] WriteRoles =
            ["SuperAdmin", "Priest", "SeniorPriest", "ServiceLeader", "Servant", "DataEntry"];

        private readonly AppDbContext _db;

        public MilestonesController(AppDbContext db) => _db = db;

        private Guid? CallerId() =>
            Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        private string CallerRole() =>
            User.FindFirstValue(ClaimTypes.Role) ?? "";

        /// <summary>GET /api/members/{memberId}/milestones</summary>
        [HttpGet("api/members/{memberId}/milestones")]
        public async Task<IActionResult> GetByMember(Guid memberId)
        {
            var items = await _db.SacramentalMilestones
                .Where(m => m.MemberId == memberId)
                .OrderBy(m => m.Date)
                .Select(m => new
                {
                    m.Id,
                    m.MemberId,
                    m.Type,
                    m.Date,
                    m.Notes,
                    m.CreatedAt,
                    RecordedByName = m.RecordedByUser != null
                        ? m.RecordedByUser.DisplayName ?? m.RecordedByUser.Username
                        : null,
                })
                .ToListAsync();

            return Ok(items);
        }

        /// <summary>POST /api/members/{memberId}/milestones</summary>
        [HttpPost("api/members/{memberId}/milestones")]
        [Authorize(Roles = "SuperAdmin,Priest,SeniorPriest,ServiceLeader,Servant,DataEntry")]
        public async Task<IActionResult> Create(Guid memberId, [FromBody] MilestoneCreateDto dto)
        {
            if (!ValidTypes.Contains(dto.Type))
                return BadRequest(new { message = $"نوع غير صالح. الأنواع المتاحة: {string.Join(", ", ValidTypes)}" });

            var callerId = CallerId();
            if (callerId == null) return Unauthorized();

            var member = await _db.FamilyMembers.FindAsync(memberId);
            if (member == null) return NotFound(new { message = "الفرد غير موجود." });

            // Prevent duplicate milestone of the same type (except Other)
            if (dto.Type != "Other")
            {
                var exists = await _db.SacramentalMilestones
                    .AnyAsync(m => m.MemberId == memberId && m.Type == dto.Type);
                if (exists)
                    return Conflict(new { message = "هذه المحطة الأسرارية مسجلة بالفعل لهذا الفرد." });
            }

            var milestone = new SacramentalMilestone
            {
                MemberId     = memberId,
                Type         = dto.Type,
                Date         = dto.Date,
                Notes        = dto.Notes,
                RecordedById = callerId.Value,
            };
            _db.SacramentalMilestones.Add(milestone);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                milestone.Id,
                milestone.MemberId,
                milestone.Type,
                milestone.Date,
                milestone.Notes,
                milestone.CreatedAt,
            });
        }

        /// <summary>DELETE /api/milestones/{id}</summary>
        [HttpDelete("api/milestones/{id}")]
        [Authorize(Roles = "SuperAdmin,Priest,SeniorPriest")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var m = await _db.SacramentalMilestones.FindAsync(id);
            if (m == null) return NotFound();
            _db.SacramentalMilestones.Remove(m);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }

    public class MilestoneCreateDto
    {
        public string Type { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string? Notes { get; set; }
    }
}
