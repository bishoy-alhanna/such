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
    public class EventsController : ControllerBase
    {
        private static readonly string[] ValidTypes      = ["Mass", "Meeting", "Trip", "Service", "Other"];
        private static readonly string[] ValidRecurrence = ["None", "Weekly", "Monthly"];
        private static readonly string[] ValidAttendance = ["Present", "Absent", "Excused"];
        private static readonly string[] WriteRoles      = ["SuperAdmin", "ServiceLeader", "Priest", "SeniorPriest", "Servant", "DataEntry"];

        private readonly AppDbContext _db;
        public EventsController(AppDbContext db) => _db = db;

        private Guid? CallerId() =>
            Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
        private string CallerRole() => User.FindFirstValue(ClaimTypes.Role) ?? "";

        // ── GET /api/events?month=2026-06&classId=…&groupId=… ──────────────────

        [HttpGet("api/events")]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? month,    // "2026-06"
            [FromQuery] Guid?   classId,
            [FromQuery] Guid?   groupId)
        {
            var query = _db.Events.AsQueryable();

            if (!string.IsNullOrWhiteSpace(month) && DateTime.TryParse(month + "-01", out var monthStart))
            {
                var monthEnd = monthStart.AddMonths(1);
                query = query.Where(e => e.StartDateTime >= monthStart && e.StartDateTime < monthEnd);
            }
            if (classId.HasValue) query = query.Where(e => e.ClassId == classId);
            if (groupId.HasValue) query = query.Where(e => e.GroupId == groupId);

            var items = await query
                .OrderBy(e => e.StartDateTime)
                .Select(e => new
                {
                    e.Id, e.Title, e.Description, e.Type,
                    e.StartDateTime, e.EndDateTime, e.Location,
                    e.ClassId, e.GroupId, e.IsRecurring, e.RecurrenceType,
                    e.CreatedAt,
                    CreatedByName = e.CreatedByUser != null
                        ? e.CreatedByUser.DisplayName ?? e.CreatedByUser.Username : null,
                    AttendanceCount = e.Attendances.Count,
                })
                .ToListAsync();

            return Ok(items);
        }

        // ── GET /api/events/{id} ────────────────────────────────────────────────

        [HttpGet("api/events/{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var e = await _db.Events
                .Include(ev => ev.Attendances).ThenInclude(a => a.Member)
                .FirstOrDefaultAsync(ev => ev.Id == id);

            if (e == null) return NotFound();

            return Ok(new
            {
                e.Id, e.Title, e.Description, e.Type,
                e.StartDateTime, e.EndDateTime, e.Location,
                e.ClassId, e.GroupId, e.IsRecurring, e.RecurrenceType, e.CreatedAt,
                Attendances = e.Attendances.Select(a => new
                {
                    a.Id, a.MemberId,
                    MemberName = a.Member?.FullName,
                    a.Status, a.MarkedAt,
                }),
            });
        }

        // ── POST /api/events ────────────────────────────────────────────────────

        [HttpPost("api/events")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest,Servant,DataEntry")]
        public async Task<IActionResult> Create([FromBody] EventCreateDto dto)
        {
            var callerId = CallerId();
            if (callerId == null) return Unauthorized();

            if (!ValidTypes.Contains(dto.Type))
                return BadRequest(new { message = "نوع الحدث غير صالح." });
            if (!ValidRecurrence.Contains(dto.RecurrenceType))
                return BadRequest(new { message = "نوع التكرار غير صالح." });

            var ev = new Event
            {
                Title          = dto.Title.Trim(),
                Description    = dto.Description?.Trim(),
                Type           = dto.Type,
                StartDateTime  = dto.StartDateTime,
                EndDateTime    = dto.EndDateTime,
                Location       = dto.Location?.Trim(),
                ClassId        = dto.ClassId,
                GroupId        = dto.GroupId,
                IsRecurring    = dto.IsRecurring,
                RecurrenceType = dto.RecurrenceType,
                CreatedById    = callerId.Value,
            };
            _db.Events.Add(ev);
            await _db.SaveChangesAsync();
            return Ok(new { ev.Id, ev.Title, ev.StartDateTime });
        }

        // ── PUT /api/events/{id} ────────────────────────────────────────────────

        [HttpPut("api/events/{id}")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest,Servant,DataEntry")]
        public async Task<IActionResult> Update(Guid id, [FromBody] EventCreateDto dto)
        {
            var ev = await _db.Events.FindAsync(id);
            if (ev == null) return NotFound();

            ev.Title          = dto.Title.Trim();
            ev.Description    = dto.Description?.Trim();
            ev.Type           = dto.Type;
            ev.StartDateTime  = dto.StartDateTime;
            ev.EndDateTime    = dto.EndDateTime;
            ev.Location       = dto.Location?.Trim();
            ev.ClassId        = dto.ClassId;
            ev.GroupId        = dto.GroupId;
            ev.IsRecurring    = dto.IsRecurring;
            ev.RecurrenceType = dto.RecurrenceType;
            await _db.SaveChangesAsync();
            return Ok(new { ev.Id });
        }

        // ── DELETE /api/events/{id} ─────────────────────────────────────────────

        [HttpDelete("api/events/{id}")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var ev = await _db.Events.FindAsync(id);
            if (ev == null) return NotFound();
            _db.Events.Remove(ev);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── POST /api/events/{id}/attendance ────────────────────────────────────

        [HttpPost("api/events/{id}/attendance")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest,Servant,DataEntry")]
        public async Task<IActionResult> MarkAttendance(Guid id, [FromBody] MarkAttendanceDto dto)
        {
            var callerId = CallerId();
            if (callerId == null) return Unauthorized();

            if (!ValidAttendance.Contains(dto.Status))
                return BadRequest(new { message = "حالة الحضور غير صالحة." });

            var ev = await _db.Events.FindAsync(id);
            if (ev == null) return NotFound(new { message = "الحدث غير موجود." });

            var existing = await _db.EventAttendances
                .FirstOrDefaultAsync(a => a.EventId == id && a.MemberId == dto.MemberId);

            if (existing != null)
            {
                existing.Status    = dto.Status;
                existing.MarkedById = callerId.Value;
                existing.MarkedAt  = DateTime.UtcNow;
            }
            else
            {
                _db.EventAttendances.Add(new EventAttendance
                {
                    EventId    = id,
                    MemberId   = dto.MemberId,
                    Status     = dto.Status,
                    MarkedById = callerId.Value,
                });
            }

            await _db.SaveChangesAsync();
            return Ok();
        }

        // ── POST /api/events/{id}/attendance/bulk ───────────────────────────────

        [HttpPost("api/events/{id}/attendance/bulk")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest,Servant,DataEntry")]
        public async Task<IActionResult> BulkAttendance(Guid id, [FromBody] List<MarkAttendanceDto> dtos)
        {
            var callerId = CallerId();
            if (callerId == null) return Unauthorized();

            var ev = await _db.Events.FindAsync(id);
            if (ev == null) return NotFound();

            var memberIds = dtos.Select(d => d.MemberId).Distinct().ToList();
            var existing  = await _db.EventAttendances
                .Where(a => a.EventId == id && memberIds.Contains(a.MemberId))
                .ToListAsync();

            foreach (var dto in dtos)
            {
                if (!ValidAttendance.Contains(dto.Status)) continue;
                var rec = existing.FirstOrDefault(a => a.MemberId == dto.MemberId);
                if (rec != null)
                {
                    rec.Status     = dto.Status;
                    rec.MarkedById = callerId.Value;
                    rec.MarkedAt   = DateTime.UtcNow;
                }
                else
                {
                    _db.EventAttendances.Add(new EventAttendance
                    {
                        EventId    = id,
                        MemberId   = dto.MemberId,
                        Status     = dto.Status,
                        MarkedById = callerId.Value,
                    });
                }
            }

            await _db.SaveChangesAsync();
            return Ok(new { saved = dtos.Count });
        }
    }

    public class EventCreateDto
    {
        public string   Title          { get; set; } = string.Empty;
        public string?  Description    { get; set; }
        public string   Type           { get; set; } = "Other";
        public DateTime StartDateTime  { get; set; }
        public DateTime? EndDateTime   { get; set; }
        public string?  Location       { get; set; }
        public Guid?    ClassId        { get; set; }
        public Guid?    GroupId        { get; set; }
        public bool     IsRecurring    { get; set; }
        public string   RecurrenceType { get; set; } = "None";
    }

    public class MarkAttendanceDto
    {
        public Guid   MemberId { get; set; }
        public string Status   { get; set; } = "Present";
    }
}
