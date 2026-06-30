using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.DTOs;
using ShepherdCare.Api.Models;
using ShepherdCare.Api.Services;
using System.Security.Claims;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AttendanceController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IAuditService _audit;

        public AttendanceController(AppDbContext db, IAuditService audit)
        {
            _db = db;
            _audit = audit;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var query = _db.AttendanceRecords.AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(a => a.AttendanceType.Contains(q) || (a.Notes != null && a.Notes.Contains(q)));

            var total = await query.CountAsync();
            var items = await query.OrderByDescending(a => a.Date).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            return Ok(new DTOs.PagedResponse<object> { Items = items, Page = page, PageSize = pageSize, TotalCount = total });
        }

        [HttpGet("by-member/{memberId}")]
        public async Task<IActionResult> GetByMember(Guid memberId)
        {
            var records = await _db.AttendanceRecords
                .Where(r => r.MemberId == memberId)
                .OrderByDescending(r => r.Date)
                .Select(r => new
                {
                    r.Id,
                    r.MemberId,
                    r.Date,
                    r.AttendanceType,
                    r.ClassId,
                    r.Notes
                })
                .ToListAsync();

            return Ok(records);
        }

        [HttpPost]
        public async Task<IActionResult> Record(AttendanceCreateDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userId, out var recordedBy))
                return Unauthorized();

            var validTypes = new[] { "SundaySchool", "Mass", "Communion", "Confession" };
            if (!validTypes.Contains(dto.AttendanceType))
                return BadRequest("AttendanceType must be SundaySchool, Mass, Communion, or Confession.");

            var member = await _db.FamilyMembers.FindAsync(dto.MemberId);
            if (member == null) return NotFound("Member not found.");

            var rec = new AttendanceRecord
            {
                Id = Guid.NewGuid(),
                MemberId = dto.MemberId,
                Date = dto.Date,
                AttendanceType = dto.AttendanceType,
                ClassId = dto.ClassId,
                RecordedById = recordedBy,
                Notes = dto.Notes
            };
            _db.AttendanceRecords.Add(rec);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "CreateAttendance", PerformedBy = User.Identity?.Name ?? "system", Entity = "AttendanceRecord", EntityId = rec.Id.ToString(), Details = rec.AttendanceType });

            return CreatedAtAction(nameof(GetById), new { id = rec.Id }, rec);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var rec = await _db.AttendanceRecords.FindAsync(id);
            if (rec == null) return NotFound();
            return Ok(rec);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, AttendanceCreateDto dto)
        {
            var rec = await _db.AttendanceRecords.FindAsync(id);
            if (rec == null) return NotFound();
            rec.MemberId = dto.MemberId;
            rec.Date = dto.Date;
            rec.AttendanceType = dto.AttendanceType;
            rec.ClassId = dto.ClassId;
            rec.RecordedById = dto.RecordedById;
            rec.Notes = dto.Notes;
            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "UpdateAttendance", PerformedBy = User.Identity?.Name ?? "system", Entity = "AttendanceRecord", EntityId = rec.Id.ToString(), Details = rec.AttendanceType });
            return NoContent();
        }

        [HttpGet("consecutive-absent")]
        public async Task<IActionResult> ChildrenAbsent([FromQuery] int weeks = 3)
        {
            // Find children who were absent for `weeks` consecutive weeks for SundaySchool
            var cutoff = DateTime.UtcNow.Date.AddDays(-7 * weeks);

            // Simplified: for each child enrolled, count recent attendances; if none in the last `weeks` weeks, return
            var children = await _db.FamilyMembers.Where(m => m.IsChild)
                .Select(m => new
                {
                    m.Id,
                    m.FullName,
                    LastAttendance = _db.AttendanceRecords.Where(a => a.MemberId == m.Id && a.AttendanceType == "SundaySchool").OrderByDescending(a => a.Date).Select(a => (DateTime?)a.Date).FirstOrDefault()
                })
                .Where(x => x.LastAttendance == null || x.LastAttendance < cutoff)
                .ToListAsync();

            return Ok(children);
        }

        [HttpGet("by-class/{classId}")]
        public async Task<IActionResult> ByClass(Guid classId, [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
        {
            var q = _db.AttendanceRecords.Where(a => a.ClassId == classId);
            if (from.HasValue) q = q.Where(a => a.Date >= from.Value);
            if (to.HasValue) q = q.Where(a => a.Date <= to.Value);
            var list = await q.ToListAsync();
            return Ok(list);
        }

        /// <summary>GET /api/attendance/my-classes — get attendance records for current user's classes</summary>
        [HttpGet("my-classes")]
        public async Task<IActionResult> GetMyClassesAttendance(
            [FromQuery] string? attendanceType, 
            [FromQuery] DateTime? date,
            [FromQuery] int page = 1, 
            [FromQuery] int pageSize = 50)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var currentUserId))
                return Unauthorized();

            IQueryable<AttendanceRecord> query;

            if (userRole == "SuperAdmin" || userRole == "Priest")
            {
                // Full access — all records
                query = _db.AttendanceRecords.Include(a => a.Member).AsQueryable();
            }
            else if (userRole == "ServiceLeader")
            {
                // Records for members in their groups' classes
                var leaderGroupIds = await _db.Groups
                    .Where(g => g.ServantUserId == currentUserId)
                    .Select(g => g.Id)
                    .ToListAsync();
                var groupClassIds = await _db.Classes
                    .Where(c => c.GroupId.HasValue && leaderGroupIds.Contains(c.GroupId.Value))
                    .Select(c => c.Id)
                    .ToListAsync();
                var memberIds = await _db.ClassEnrollments
                    .Where(e => groupClassIds.Contains(e.ClassId))
                    .Select(e => e.MemberId)
                    .ToListAsync();
                query = _db.AttendanceRecords.Include(a => a.Member)
                    .Where(a => memberIds.Contains(a.MemberId));
            }
            else
            {
                // Servant — only their own classes
                var servantClassIds = await _db.Servants
                    .Where(s => s.UserId == currentUserId)
                    .Select(s => s.ClassId)
                    .ToListAsync();
                    
                if (servantClassIds.Count == 0)
                    return Ok(new { Items = new List<object>(), Page = page, PageSize = pageSize, TotalCount = 0 });

                var enrolledMemberIds = await _db.ClassEnrollments
                    .Where(e => servantClassIds.Contains(e.ClassId))
                    .Select(e => e.MemberId)
                    .ToListAsync();

                query = _db.AttendanceRecords.Include(a => a.Member)
                    .Where(a => enrolledMemberIds.Contains(a.MemberId));
            }

            if (!string.IsNullOrEmpty(attendanceType))
                query = query.Where(a => a.AttendanceType == attendanceType);
                
            if (date.HasValue)
            {
                var dateOnly = date.Value.Date;
                var nextDay = dateOnly.AddDays(1);
                query = query.Where(a => a.Date >= dateOnly && a.Date < nextDay);
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(a => a.Date)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new
                {
                    a.Id,
                    a.MemberId,
                    MemberName = a.Member != null ? a.Member.FullName : null,
                    a.Date,
                    a.AttendanceType,
                    a.ClassId,
                    a.RecordedById,
                    a.Notes
                })
                .ToListAsync();

            return Ok(new { Items = items, Page = page, PageSize = pageSize, TotalCount = total });
        }

        /// <summary>GET /api/attendance/class-members-status — get members with their attendance status for a specific date</summary>
        [HttpGet("class-members-status")]
        public async Task<IActionResult> GetClassMembersStatus(
            [FromQuery] DateTime date,
            [FromQuery] string attendanceType)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var currentUserId))
                return Unauthorized();

            List<Guid> allowedClassIds;

            if (userRole == "SuperAdmin" || userRole == "Priest")
            {
                // All classes
                allowedClassIds = await _db.Classes.Select(c => c.Id).ToListAsync();
            }
            else if (userRole == "ServiceLeader")
            {
                var leaderGroupIds = await _db.Groups
                    .Where(g => g.ServantUserId == currentUserId)
                    .Select(g => g.Id)
                    .ToListAsync();
                allowedClassIds = await _db.Classes
                    .Where(c => c.GroupId.HasValue && leaderGroupIds.Contains(c.GroupId.Value))
                    .Select(c => c.Id)
                    .ToListAsync();
            }
            else
            {
                // Servant — only their assigned classes
                allowedClassIds = await _db.Servants
                    .Where(s => s.UserId == currentUserId)
                    .Select(s => s.ClassId)
                    .ToListAsync();
            }

            if (allowedClassIds.Count == 0)
                return Ok(new List<object>());

            // Get enrolled members with their class info
            var enrolledMembers = await _db.ClassEnrollments
                .Include(e => e.Member)
                .Include(e => e.Class)
                .Where(e => allowedClassIds.Contains(e.ClassId))
                .Select(e => new
                {
                    MemberId = e.MemberId,
                    MemberName = e.Member.FullName,
                    ClassId = e.ClassId,
                    ClassName = e.Class.ClassName
                })
                .Distinct()
                .ToListAsync();

            var dateOnly = date.Date;
            var nextDay = dateOnly.AddDays(1);

            // Get existing attendance records for this date and type
            var existingAttendance = await _db.AttendanceRecords
                .Where(a => a.Date >= dateOnly && a.Date < nextDay && a.AttendanceType == attendanceType)
                .Where(a => enrolledMembers.Select(m => m.MemberId).Contains(a.MemberId))
                .Select(a => new { a.Id, a.MemberId, a.Notes })
                .ToListAsync();

            var result = enrolledMembers.Select(m =>
            {
                var attendance = existingAttendance.FirstOrDefault(a => a.MemberId == m.MemberId);
                return new
                {
                    m.MemberId,
                    m.MemberName,
                    m.ClassId,
                    m.ClassName,
                    IsPresent = attendance != null,
                    AttendanceId = attendance?.Id,
                    Notes = attendance?.Notes
                };
            }).ToList();

            return Ok(result);
        }

        /// <summary>POST /api/attendance/bulk — record bulk attendance</summary>
        [HttpPost("bulk")]
        public async Task<IActionResult> RecordBulkAttendance([FromBody] BulkAttendanceDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var currentUserId))
                return Unauthorized();

            var userRole = User.FindFirstValue(ClaimTypes.Role);

            // Verify servant has access to these members
            if (userRole == "Servant")
            {
                var servantClassIds = await _db.Servants
                    .Where(s => s.UserId == currentUserId)
                    .Select(s => s.ClassId)
                    .ToListAsync();
                    
                var enrolledMemberIds = await _db.ClassEnrollments
                    .Where(e => servantClassIds.Contains(e.ClassId))
                    .Select(e => e.MemberId)
                    .ToListAsync();

                // Check all member IDs are in servant's classes
                var invalidMembers = dto.MemberIds.Except(enrolledMemberIds).ToList();
                if (invalidMembers.Any())
                {
                    return Forbid("You can only record attendance for members in your assigned classes.");
                }
            }

            var dateOnly = dto.Date.Date;
            var nextDay = dateOnly.AddDays(1);

            // Remove existing attendance records for these members on this date and type
            var existingRecords = await _db.AttendanceRecords
                .Where(a => dto.MemberIds.Contains(a.MemberId))
                .Where(a => a.Date >= dateOnly && a.Date < nextDay)
                .Where(a => a.AttendanceType == dto.AttendanceType)
                .ToListAsync();

            _db.AttendanceRecords.RemoveRange(existingRecords);

            // Add new attendance records
            var newRecords = dto.MemberIds.Select(memberId => new AttendanceRecord
            {
                Id = Guid.NewGuid(),
                MemberId = memberId,
                Date = dateOnly,
                AttendanceType = dto.AttendanceType,
                ClassId = dto.ClassId,
                RecordedById = currentUserId,
                Notes = dto.Notes
            }).ToList();

            _db.AttendanceRecords.AddRange(newRecords);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog 
            { 
                Action = "BulkAttendance", 
                PerformedBy = User.Identity?.Name ?? "system", 
                Entity = "AttendanceRecord", 
                EntityId = dto.Date.ToString("yyyy-MM-dd"), 
                Details = $"{dto.AttendanceType}: {newRecords.Count} members" 
            });

            return Ok(new { RecordedCount = newRecords.Count });
        }

        /// <summary>DELETE /api/attendance/{id} — delete an attendance record</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var currentUserId))
                return Unauthorized();

            var record = await _db.AttendanceRecords
                .Include(a => a.Member)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (record == null)
                return NotFound();

            // Check permissions
            // SuperAdmin and Priest can delete any record
            // Servant can only delete records for their class members
            if (userRole == "Servant")
            {
                var servantClassIds = await _db.Servants
                    .Where(s => s.UserId == currentUserId)
                    .Select(s => s.ClassId)
                    .ToListAsync();

                var enrolledMemberIds = await _db.ClassEnrollments
                    .Where(e => servantClassIds.Contains(e.ClassId))
                    .Select(e => e.MemberId)
                    .ToListAsync();

                if (!enrolledMemberIds.Contains(record.MemberId))
                {
                    return Forbid("You can only delete attendance records for members in your assigned classes.");
                }
            }

            _db.AttendanceRecords.Remove(record);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog
            {
                Action = "DeleteAttendance",
                PerformedBy = User.Identity?.Name ?? "system",
                Entity = "AttendanceRecord",
                EntityId = id.ToString(),
                Details = $"{record.AttendanceType} - {record.Member?.FullName}"
            });

            return NoContent();
        }
    }
}
