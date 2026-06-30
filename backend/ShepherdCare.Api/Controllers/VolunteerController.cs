using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/volunteer")]
    [Authorize]
    public class VolunteerController : ControllerBase
    {
        private readonly AppDbContext _db;
        public VolunteerController(AppDbContext db) => _db = db;

        // ── Assignments ──────────────────────────────────────────────────────

        /// <summary>GET /api/volunteer?role=&from=&to=&memberId= — assignments list</summary>
        [HttpGet]
        public async Task<IActionResult> GetAssignments(
            [FromQuery] string? role,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] Guid? memberId)
        {
            var q = _db.VolunteerAssignments
                .Include(v => v.Member).ThenInclude(m => m!.Family)
                .Include(v => v.Event)
                .AsQueryable();

            if (!string.IsNullOrEmpty(role)) q = q.Where(v => v.Role == role);
            if (from.HasValue)  q = q.Where(v => v.AssignedDate >= from.Value.Date);
            if (to.HasValue)    q = q.Where(v => v.AssignedDate <= to.Value.Date);
            if (memberId.HasValue) q = q.Where(v => v.MemberId == memberId.Value);

            // Scope servants to their own class members
            var userId   = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            Guid.TryParse(userId, out var uid);
            if (userRole == "Servant" || userRole == "DataEntry")
            {
                var classIds  = await _db.Servants.Where(s => s.UserId == uid).Select(s => s.ClassId).ToListAsync();
                var memberIds = await _db.ClassEnrollments.Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).ToListAsync();
                q = q.Where(v => memberIds.Contains(v.MemberId));
            }

            var items = await q.OrderByDescending(v => v.AssignedDate).ThenBy(v => v.Role).ToListAsync();
            return Ok(items.Select(v => new {
                v.Id, v.MemberId,
                MemberName = v.Member != null ? v.Member.FullName : "",
                FamilyName = v.Member != null && v.Member.Family != null ? v.Member.Family.FamilyName : "",
                v.Role,
                AssignedDate = v.AssignedDate?.ToString("yyyy-MM-dd"),
                EventTitle   = v.Event?.Title,
                v.EventId, v.Notes, v.IsRecurring, v.CreatedAt,
            }));
        }

        /// <summary>POST /api/volunteer — create assignment</summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] AssignmentCreateDto dto)
        {
            if (!await _db.FamilyMembers.AnyAsync(m => m.Id == dto.MemberId))
                return NotFound("Member not found.");

            var validRoles = new[] { "Deacon", "Reader", "Cantor", "Setup", "Childcare", "Hospitality", "Other" };
            if (!validRoles.Contains(dto.Role)) return BadRequest("Invalid role.");

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            Guid.TryParse(userId, out var uid);

            var item = new VolunteerAssignment
            {
                MemberId     = dto.MemberId,
                Role         = dto.Role,
                AssignedDate = dto.AssignedDate?.Date,
                EventId      = dto.EventId,
                Notes        = dto.Notes,
                IsRecurring  = dto.IsRecurring,
                CreatedById  = uid,
            };
            _db.VolunteerAssignments.Add(item);
            await _db.SaveChangesAsync();
            return Ok(new { item.Id });
        }

        /// <summary>PUT /api/volunteer/{id}</summary>
        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] AssignmentCreateDto dto)
        {
            var item = await _db.VolunteerAssignments.FindAsync(id);
            if (item == null) return NotFound();
            item.Role        = dto.Role;
            item.AssignedDate = dto.AssignedDate?.Date;
            item.EventId     = dto.EventId;
            item.Notes       = dto.Notes;
            item.IsRecurring = dto.IsRecurring;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>DELETE /api/volunteer/{id}</summary>
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var item = await _db.VolunteerAssignments.FindAsync(id);
            if (item == null) return NotFound();
            _db.VolunteerAssignments.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── Service hours ────────────────────────────────────────────────────

        /// <summary>GET /api/volunteer/service-hours?memberId=&year=</summary>
        [HttpGet("service-hours")]
        public async Task<IActionResult> GetHours([FromQuery] Guid? memberId, [FromQuery] int? year)
        {
            var q = _db.ServiceHours.Include(s => s.Member).ThenInclude(m => m!.Family).AsQueryable();
            if (memberId.HasValue) q = q.Where(s => s.MemberId == memberId.Value);
            if (year.HasValue)     q = q.Where(s => s.Date.Year == year.Value);

            var items = await q.OrderByDescending(s => s.Date).ToListAsync();
            return Ok(items.Select(s => new {
                s.Id, s.MemberId,
                MemberName = s.Member != null ? s.Member.FullName : "",
                FamilyName = s.Member != null && s.Member.Family != null ? s.Member.Family.FamilyName : "",
                Date       = s.Date.ToString("yyyy-MM-dd"),
                s.Hours, s.Activity, s.Notes, s.CreatedAt,
            }));
        }

        /// <summary>POST /api/volunteer/service-hours — add hours</summary>
        [HttpPost("service-hours")]
        public async Task<IActionResult> AddHours([FromBody] ServiceHoursDto dto)
        {
            if (!await _db.FamilyMembers.AnyAsync(m => m.Id == dto.MemberId))
                return NotFound("Member not found.");

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            Guid.TryParse(userId, out var uid);

            var item = new ServiceHours
            {
                MemberId     = dto.MemberId,
                Date         = dto.Date.Date,
                Hours        = dto.Hours,
                Activity     = dto.Activity,
                Notes        = dto.Notes,
                RecordedById = uid,
            };
            _db.ServiceHours.Add(item);
            await _db.SaveChangesAsync();
            return Ok(new { item.Id });
        }

        /// <summary>DELETE /api/volunteer/service-hours/{id}</summary>
        [HttpDelete("service-hours/{id:guid}")]
        public async Task<IActionResult> DeleteHours(Guid id)
        {
            var item = await _db.ServiceHours.FindAsync(id);
            if (item == null) return NotFound();
            _db.ServiceHours.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>GET /api/volunteer/leaderboard?year= — top volunteers by hours</summary>
        [HttpGet("leaderboard")]
        public async Task<IActionResult> GetLeaderboard([FromQuery] int? year)
        {
            var y = year ?? DateTime.UtcNow.Year;
            var results = await _db.ServiceHours
                .Include(s => s.Member)
                .Where(s => s.Date.Year == y)
                .GroupBy(s => new { s.MemberId, s.Member!.FullName })
                .Select(g => new {
                    memberId   = g.Key.MemberId,
                    memberName = g.Key.FullName,
                    totalHours = g.Sum(s => s.Hours),
                    entryCount = g.Count(),
                })
                .OrderByDescending(x => x.totalHours)
                .Take(20)
                .ToListAsync();
            return Ok(results);
        }
    }

    public class AssignmentCreateDto
    {
        public Guid      MemberId     { get; set; }
        public string    Role         { get; set; } = "Other";
        public DateTime? AssignedDate { get; set; }
        public Guid?     EventId      { get; set; }
        public string?   Notes        { get; set; }
        public bool      IsRecurring  { get; set; }
    }

    public class ServiceHoursDto
    {
        public Guid     MemberId { get; set; }
        public DateTime Date     { get; set; } = DateTime.UtcNow;
        public decimal  Hours    { get; set; }
        public string   Activity { get; set; } = "";
        public string?  Notes    { get; set; }
    }
}
