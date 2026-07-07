using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;
using ShepherdCare.Api.Services;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ClassesController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IAuditService _audit;

        public ClassesController(AppDbContext db, IAuditService audit)
        {
            _db = db;
            _audit = audit;
        }

        // Age as of Sep 15 of the given year
        private static int AgeOnSep15(DateTime dob, int year)
        {
            var refDate = new DateTime(year, 9, 15);
            var age = refDate.Year - dob.Year;
            if (dob.Date > refDate.AddYears(-age)) age--;
            return age;
        }

        // ── List ─────────────────────────────────────────────────────────────
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? q, [FromQuery] Guid? groupId,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var query = _db.Classes.AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(c => c.ClassName.Contains(q));
            if (groupId.HasValue)
                query = query.Where(c => c.GroupId == groupId.Value);

            // Servants only see classes they are assigned to
            if (User.IsInRole("Servant"))
            {
                var userId = Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                             ?? User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
                query = query.Where(c => c.Servants.Any(s => s.UserId == userId));
            }
            // ServiceLeaders only see classes belonging to their group
            else if (User.IsInRole("ServiceLeader"))
            {
                var userId = Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                             ?? User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
                var leaderGroupIds = await _db.Groups
                    .Where(g => g.ServantUserId == userId)
                    .Select(g => g.Id)
                    .ToListAsync();
                query = query.Where(c => c.GroupId != null && leaderGroupIds.Contains(c.GroupId.Value));
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderBy(c => c.ClassName)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(c => new
                {
                    c.Id, c.ClassName, c.AgeGroup, c.MinAge, c.MaxAge, c.GroupId,
                    GroupName    = c.Group != null ? c.Group.Name : null,
                    ServantCount = c.Servants.Count,
                    MemberCount  = c.ClassEnrollments.Count
                })
                .ToListAsync();

            return Ok(new { Items = items, Page = page, PageSize = pageSize, TotalCount = total,
                TotalPages = (int)Math.Ceiling(total / (double)pageSize) });
        }

        // ── Detail ───────────────────────────────────────────────────────────
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var c = await _db.Classes
                .Include(c => c.Group)
                .Include(c => c.Servants)
                .Include(c => c.ClassEnrollments)
                    .ThenInclude(e => e.Member)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (c == null) return NotFound();

            var servantUserIds = c.Servants.Select(s => s.UserId).ToList();
            var servantUsers = await _db.Users
                .Where(u => servantUserIds.Contains(u.Id))
                .Select(u => new { u.Id, Name = u.DisplayName ?? u.Username })
                .ToListAsync();

            return Ok(new
            {
                c.Id, c.ClassName, c.AgeGroup, c.MinAge, c.MaxAge, c.GroupId,
                GroupName = c.Group != null ? c.Group.Name : null,
                Servants = c.Servants.Select(s => new
                {
                    s.Id, s.UserId,
                    Name = servantUsers.FirstOrDefault(u => u.Id == s.UserId)!.Name
                }),
                Members = c.ClassEnrollments.Select(e => new
                {
                    e.Id, e.MemberId, e.AcademicYear,
                    FullName = e.Member != null ? e.Member.FullName : null,
                    Gender   = e.Member != null ? e.Member.Gender : null,
                    Relation = e.Member != null ? e.Member.Relation : null
                })
            });
        }

        // ── Create ───────────────────────────────────────────────────────────
        [HttpPost]
        [Authorize(Roles = "SuperAdmin,ServiceLeader")]
        public async Task<IActionResult> Create([FromBody] ClassUpsertDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.ClassName)) return BadRequest("ClassName is required.");
            var c = new Class
            {
                Id = Guid.NewGuid(),
                ClassName = dto.ClassName.Trim(),
                AgeGroup = dto.AgeGroup,
                MinAge = dto.MinAge,
                MaxAge = dto.MaxAge,
                ServiceId = dto.ServiceId,
                ClassLeaderId = dto.ClassLeaderId,
                GroupId = dto.GroupId
            };
            _db.Classes.Add(c);
            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "CreateClass", PerformedBy = User.Identity?.Name ?? "system", Entity = "Class", EntityId = c.Id.ToString(), Details = c.ClassName });
            return CreatedAtAction(nameof(GetById), new { id = c.Id }, new { c.Id, c.ClassName, c.AgeGroup, c.MinAge, c.MaxAge, c.GroupId });
        }

        // ── Update ───────────────────────────────────────────────────────────
        [HttpPut("{id}")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader")]
        public async Task<IActionResult> Update(Guid id, [FromBody] ClassUpsertDto dto)
        {
            var c = await _db.Classes.FindAsync(id);
            if (c == null) return NotFound();
            c.ClassName = dto.ClassName.Trim();
            c.AgeGroup = dto.AgeGroup;
            c.MinAge = dto.MinAge;
            c.MaxAge = dto.MaxAge;
            c.ServiceId = dto.ServiceId;
            c.ClassLeaderId = dto.ClassLeaderId;
            c.GroupId = dto.GroupId;
            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "UpdateClass", PerformedBy = User.Identity?.Name ?? "system", Entity = "Class", EntityId = c.Id.ToString(), Details = c.ClassName });
            return NoContent();
        }

        // ── Delete ───────────────────────────────────────────────────────────
        [HttpDelete("{id}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var c = await _db.Classes.FindAsync(id);
            if (c == null) return NotFound();
            _db.Classes.Remove(c);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── Servants ─────────────────────────────────────────────────────────
        [HttpPost("{id}/servants")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader")]
        public async Task<IActionResult> AddServant(Guid id, [FromBody] ServantAssignDto dto)
        {
            if (!await _db.Classes.AnyAsync(c => c.Id == id)) return NotFound("Class not found.");
            if (!await _db.Users.AnyAsync(u => u.Id == dto.UserId)) return NotFound("User not found.");
            if (await _db.Servants.AnyAsync(s => s.ClassId == id && s.UserId == dto.UserId))
                return Conflict("User is already a servant for this class.");

            var servant = new Servant { Id = Guid.NewGuid(), ClassId = id, UserId = dto.UserId };
            _db.Servants.Add(servant);
            await _db.SaveChangesAsync();

            var user = await _db.Users.FindAsync(dto.UserId);
            return Ok(new { servant.Id, servant.UserId, Name = user!.DisplayName ?? user.Username });
        }

        [HttpDelete("{id}/servants/{servantId}")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader")]
        public async Task<IActionResult> RemoveServant(Guid id, Guid servantId)
        {
            var servant = await _db.Servants.FirstOrDefaultAsync(s => s.Id == servantId && s.ClassId == id);
            if (servant == null) return NotFound();
            _db.Servants.Remove(servant);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── Members (Enrollments) ────────────────────────────────────────────
        [HttpPost("{id}/members")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,DataEntry")]
        public async Task<IActionResult> EnrollMember(Guid id, [FromBody] EnrollDto dto)
        {
            if (!await _db.Classes.AnyAsync(c => c.Id == id)) return NotFound("Class not found.");
            var member = await _db.FamilyMembers.FindAsync(dto.MemberId);
            if (member == null) return NotFound("Member not found.");
            if (await _db.ClassEnrollments.AnyAsync(e => e.ClassId == id && e.MemberId == dto.MemberId))
                return Conflict("Member is already enrolled in this class.");

            var year = string.IsNullOrWhiteSpace(dto.AcademicYear) ? DateTime.UtcNow.Year.ToString() : dto.AcademicYear.Trim();
            var enroll = new ClassEnrollment { Id = Guid.NewGuid(), ClassId = id, MemberId = dto.MemberId, AcademicYear = year };
            _db.ClassEnrollments.Add(enroll);
            await _db.SaveChangesAsync();

            return Ok(new { enroll.Id, enroll.MemberId, enroll.AcademicYear, member.FullName, member.Gender, member.Relation });
        }

        [HttpDelete("{id}/members/{enrollmentId}")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,DataEntry")]
        public async Task<IActionResult> RemoveMember(Guid id, Guid enrollmentId)
        {
            var enroll = await _db.ClassEnrollments.FirstOrDefaultAsync(e => e.Id == enrollmentId && e.ClassId == id);
            if (enroll == null) return NotFound();
            _db.ClassEnrollments.Remove(enroll);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── Auto-Enroll by Age ───────────────────────────────────────────────
        // Age is calculated as of September 15 of the current year (Coptic academic year cutoff).
        [HttpPost("{id}/auto-enroll")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest")]
        public async Task<IActionResult> AutoEnroll(Guid id)
        {
            var cls = await _db.Classes.FindAsync(id);
            if (cls == null) return NotFound("Class not found.");
            if (cls.MinAge == null && cls.MaxAge == null)
                return BadRequest("Class has no age range configured.");

            var year = DateTime.UtcNow.Year;
            var academicYear = year.ToString();

            // Load all church members who have a date of birth
            var members = await _db.FamilyMembers
                .Where(m => m.DateOfBirth != null)
                .Select(m => new { m.Id, m.DateOfBirth })
                .ToListAsync();

            // Filter by age on Sep 15 of the current year
            var eligible = members
                .Where(m => {
                    var age = AgeOnSep15(m.DateOfBirth!.Value, year);
                    var minOk = cls.MinAge == null || age >= cls.MinAge.Value;
                    var maxOk = cls.MaxAge == null || age <= cls.MaxAge.Value;
                    return minOk && maxOk;
                })
                .Select(m => m.Id)
                .ToList();

            if (eligible.Count == 0)
                return Ok(new { Enrolled = 0, Skipped = 0, Message = "No members found in the age range." });

            // Exclude already enrolled
            var alreadyEnrolled = await _db.ClassEnrollments
                .Where(e => e.ClassId == id && eligible.Contains(e.MemberId))
                .Select(e => e.MemberId)
                .ToListAsync();

            var toEnroll = eligible.Except(alreadyEnrolled).ToList();

            foreach (var memberId in toEnroll)
            {
                _db.ClassEnrollments.Add(new ClassEnrollment
                {
                    Id           = Guid.NewGuid(),
                    ClassId      = id,
                    MemberId     = memberId,
                    AcademicYear = academicYear
                });
            }

            if (toEnroll.Count > 0)
                await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog
            {
                Action      = "AutoEnrollClass",
                PerformedBy = User.Identity?.Name ?? "system",
                Entity      = "Class",
                EntityId    = id.ToString(),
                Details     = $"Auto-enrolled {toEnroll.Count} members (ages {cls.MinAge}–{cls.MaxAge} as of Sep 15 {year})"
            });

            return Ok(new { Enrolled = toEnroll.Count, Skipped = alreadyEnrolled.Count,
                Message = $"Enrolled {toEnroll.Count} member(s). {alreadyEnrolled.Count} were already in the class." });
        }
    }

    public class ClassUpsertDto
    {
        public string ClassName { get; set; } = string.Empty;
        public string? AgeGroup { get; set; }
        public int? MinAge { get; set; }
        public int? MaxAge { get; set; }
        public Guid? ServiceId { get; set; }
        public Guid? ClassLeaderId { get; set; }
        public Guid? GroupId { get; set; }
    }

    public class ServantAssignDto { public Guid UserId { get; set; } }
    public class EnrollDto
    {
        public Guid MemberId { get; set; }
        public string? AcademicYear { get; set; }
    }
}
