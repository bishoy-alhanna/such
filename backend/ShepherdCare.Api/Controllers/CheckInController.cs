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
    [Route("api/checkin")]
    [Authorize]
    public class CheckInController : ControllerBase
    {
        private readonly AppDbContext _db;
        public CheckInController(AppDbContext db) => _db = db;

        /// <summary>GET /api/checkin/today?type= — today's check-ins</summary>
        [HttpGet("today")]
        public async Task<IActionResult> GetToday([FromQuery] string? type)
        {
            var today = DateTime.UtcNow.Date;
            var q = _db.AttendanceRecords
                .Include(a => a.Member).ThenInclude(m => m!.Family)
                .Where(a => a.Date >= today && a.Date < today.AddDays(1));

            if (!string.IsNullOrEmpty(type))
                q = q.Where(a => a.AttendanceType == type);

            var userId   = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            Guid.TryParse(userId, out var uid);

            if (userRole == "Servant" || userRole == "DataEntry")
            {
                var classIds  = await _db.Servants.Where(s => s.UserId == uid).Select(s => s.ClassId).ToListAsync();
                var memberIds = await _db.ClassEnrollments.Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).ToListAsync();
                q = q.Where(a => memberIds.Contains(a.MemberId));
            }

            var records = await q.OrderByDescending(a => a.Date).ToListAsync();
            return Ok(records.Select(a => new {
                a.Id,
                a.MemberId,
                MemberName  = a.Member != null ? a.Member.FullName : "",
                FamilyName  = a.Member != null && a.Member.Family != null ? a.Member.Family.FamilyName : "",
                a.AttendanceType,
                CheckedInAt = a.Date,
            }));
        }

        /// <summary>POST /api/checkin — mark attendance for today</summary>
        [HttpPost]
        public async Task<IActionResult> CheckIn([FromBody] CheckInDto dto)
        {
            if (!Guid.TryParse(dto.MemberId, out var memberId))
                return BadRequest("Invalid member ID.");

            var member = await _db.FamilyMembers.Include(m => m.Family).FirstOrDefaultAsync(m => m.Id == memberId);
            if (member == null) return NotFound("Member not found.");

            var validTypes = new[] { "Mass", "SundaySchool" };
            if (!validTypes.Contains(dto.Type)) return BadRequest("Type must be Mass or SundaySchool.");

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            Guid.TryParse(userId, out var uid);

            var today  = DateTime.UtcNow.Date;
            var exists = await _db.AttendanceRecords.AnyAsync(a =>
                a.MemberId == memberId &&
                a.AttendanceType == dto.Type &&
                a.Date >= today && a.Date < today.AddDays(1));

            if (exists)
                return Conflict(new { message = "Already checked in today.", alreadyCheckedIn = true });

            var record = new AttendanceRecord
            {
                Id             = Guid.NewGuid(),
                MemberId       = memberId,
                Date           = DateTime.UtcNow,
                AttendanceType = dto.Type,
                RecordedById   = uid,
                Notes          = "check-in",
            };
            _db.AttendanceRecords.Add(record);
            await _db.SaveChangesAsync();

            return Ok(new {
                record.Id,
                record.MemberId,
                MemberName  = member.FullName,
                FamilyName  = member.Family != null ? member.Family.FamilyName : "",
                record.AttendanceType,
                CheckedInAt = record.Date,
            });
        }

        /// <summary>DELETE /api/checkin/{id} — undo a check-in</summary>
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Undo(Guid id)
        {
            var record = await _db.AttendanceRecords.FindAsync(id);
            if (record == null) return NotFound();

            var today = DateTime.UtcNow.Date;
            if (record.Date < today)
                return BadRequest("Can only undo today's check-ins.");

            _db.AttendanceRecords.Remove(record);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>GET /api/checkin/search?q= — member name search for check-in</summary>
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Length < 2) return Ok(Array.Empty<object>());

            var userId   = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            Guid.TryParse(userId, out var uid);

            var query = _db.FamilyMembers
                .Include(m => m.Family)
                .Where(m => m.FullName.Contains(q));

            if (userRole == "Servant" || userRole == "DataEntry")
            {
                var classIds  = await _db.Servants.Where(s => s.UserId == uid).Select(s => s.ClassId).ToListAsync();
                var memberIds = await _db.ClassEnrollments.Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).ToListAsync();
                query = query.Where(m => memberIds.Contains(m.Id));
            }

            var members = await query.Take(20).ToListAsync();

            var today = DateTime.UtcNow.Date;
            var checkedInToday = await _db.AttendanceRecords
                .Where(a => a.Date >= today && a.Date < today.AddDays(1))
                .Select(a => new { a.MemberId, a.AttendanceType })
                .ToListAsync();

            return Ok(members.Select(m => new {
                id              = m.Id,
                fullName        = m.FullName,
                familyName      = m.Family != null ? m.Family.FamilyName : "",
                checkedInMass   = checkedInToday.Any(c => c.MemberId == m.Id && c.AttendanceType == "Mass"),
                checkedInSchool = checkedInToday.Any(c => c.MemberId == m.Id && c.AttendanceType == "SundaySchool"),
            }));
        }
    }

    public class CheckInDto
    {
        public string MemberId { get; set; } = "";
        public string Type     { get; set; } = "Mass";
    }
}
