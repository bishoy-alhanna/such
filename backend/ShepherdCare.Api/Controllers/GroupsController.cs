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
    public class GroupsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IAuditService _audit;

        public GroupsController(AppDbContext db, IAuditService audit)
        {
            _db = db;
            _audit = audit;
        }

        // Age as of Sep 15 of the given year (mirrors ClassesController)
        private static int AgeOnSep15(DateTime dob, int year)
        {
            var refDate = new DateTime(year, 9, 15);
            var age = refDate.Year - dob.Year;
            if (dob.Date > refDate.AddYears(-age)) age--;
            return age;
        }

        // GET /api/groups
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var groups = await _db.Groups
                .Include(g => g.ServantUser)
                .Include(g => g.Classes)
                    .ThenInclude(c => c.Servants)
                .OrderBy(g => g.Name)
                .Select(g => new
                {
                    g.Id,
                    g.Name,
                    g.ServantUserId,
                    ServantName = g.ServantUser != null ? (g.ServantUser.DisplayName ?? g.ServantUser.Username) : null,
                    Classes = g.Classes.OrderBy(c => c.ClassName).Select(c => new
                    {
                        c.Id,
                        c.ClassName,
                        c.AgeGroup,
                        c.MinAge,
                        c.MaxAge,
                        ServantCount = c.Servants.Count,
                        MemberCount  = c.ClassEnrollments.Count
                    })
                })
                .ToListAsync();

            return Ok(groups);
        }

        // GET /api/groups/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var g = await _db.Groups
                .Include(g => g.ServantUser)
                .Include(g => g.Classes)
                    .ThenInclude(c => c.Servants)
                .Where(g => g.Id == id)
                .Select(g => new
                {
                    g.Id,
                    g.Name,
                    g.ServantUserId,
                    ServantName = g.ServantUser != null ? (g.ServantUser.DisplayName ?? g.ServantUser.Username) : null,
                    Classes = g.Classes.OrderBy(c => c.ClassName).Select(c => new
                    {
                        c.Id,
                        c.ClassName,
                        c.AgeGroup,
                        c.MinAge,
                        c.MaxAge,
                        ServantCount = c.Servants.Count,
                        MemberCount  = c.ClassEnrollments.Count
                    })
                })
                .FirstOrDefaultAsync();

            if (g == null) return NotFound();
            return Ok(g);
        }

        // POST /api/groups/{id}/auto-enroll — enroll by age into all classes in this group
        [HttpPost("{id}/auto-enroll")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest")]
        public async Task<IActionResult> AutoEnrollGroup(Guid id)
        {
            var classes = await _db.Classes
                .Where(c => c.GroupId == id && (c.MinAge != null || c.MaxAge != null))
                .ToListAsync();

            if (!classes.Any())
                return BadRequest("No classes with an age range found in this group.");

            return Ok(await RunAutoEnroll(classes));
        }

        // POST /api/groups/auto-enroll-all — enroll by age into every class across all groups
        [HttpPost("auto-enroll-all")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest")]
        public async Task<IActionResult> AutoEnrollAll()
        {
            var classes = await _db.Classes
                .Where(c => c.MinAge != null || c.MaxAge != null)
                .ToListAsync();

            if (!classes.Any())
                return BadRequest("No classes with an age range configured.");

            return Ok(await RunAutoEnroll(classes));
        }

        private async Task<object> RunAutoEnroll(List<Class> classes)
        {
            var year = DateTime.UtcNow.Year;
            var academicYear = year.ToString();

            var members = await _db.FamilyMembers
                .Where(m => m.DateOfBirth != null)
                .Select(m => new { m.Id, m.DateOfBirth })
                .ToListAsync();

            int totalEnrolled = 0, totalSkipped = 0;

            foreach (var cls in classes)
            {
                var eligible = members
                    .Where(m => {
                        var age = AgeOnSep15(m.DateOfBirth!.Value, year);
                        return (cls.MinAge == null || age >= cls.MinAge.Value)
                            && (cls.MaxAge == null || age <= cls.MaxAge.Value);
                    })
                    .Select(m => m.Id)
                    .ToList();

                if (!eligible.Any()) continue;

                var alreadyEnrolled = await _db.ClassEnrollments
                    .Where(e => e.ClassId == cls.Id && eligible.Contains(e.MemberId))
                    .Select(e => e.MemberId)
                    .ToListAsync();

                var toEnroll = eligible.Except(alreadyEnrolled).ToList();
                totalSkipped += alreadyEnrolled.Count;

                foreach (var memberId in toEnroll)
                    _db.ClassEnrollments.Add(new ClassEnrollment
                        { Id = Guid.NewGuid(), ClassId = cls.Id, MemberId = memberId, AcademicYear = academicYear });

                totalEnrolled += toEnroll.Count;
            }

            if (totalEnrolled > 0) await _db.SaveChangesAsync();

            return new
            {
                Enrolled = totalEnrolled,
                Skipped  = totalSkipped,
                Classes  = classes.Count,
                Message  = $"Enrolled {totalEnrolled} member(s) across {classes.Count} class(es). {totalSkipped} already enrolled."
            };
        }

        // POST /api/groups
        [HttpPost]
        [Authorize(Roles = "SuperAdmin,ServiceLeader")]
        public async Task<IActionResult> Create([FromBody] GroupDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");
            var group = new Group { Id = Guid.NewGuid(), Name = dto.Name.Trim(), ServantUserId = dto.ServantUserId };
            _db.Groups.Add(group);
            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "CreateGroup", PerformedBy = User.Identity?.Name ?? "system", Entity = "Group", EntityId = group.Id.ToString(), Details = group.Name });
            return CreatedAtAction(nameof(GetById), new { id = group.Id }, new { group.Id, group.Name, group.ServantUserId });
        }

        // PUT /api/groups/{id}
        [HttpPut("{id}")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader")]
        public async Task<IActionResult> Update(Guid id, [FromBody] GroupDto dto)
        {
            var group = await _db.Groups.FindAsync(id);
            if (group == null) return NotFound();
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");
            group.Name = dto.Name.Trim();
            group.ServantUserId = dto.ServantUserId;
            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "UpdateGroup", PerformedBy = User.Identity?.Name ?? "system", Entity = "Group", EntityId = group.Id.ToString(), Details = group.Name });
            return NoContent();
        }

        // DELETE /api/groups/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var group = await _db.Groups.FindAsync(id);
            if (group == null) return NotFound();
            _db.Groups.Remove(group);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }

    public class GroupDto
    {
        public string Name { get; set; } = string.Empty;
        public Guid? ServantUserId { get; set; }
    }
}
