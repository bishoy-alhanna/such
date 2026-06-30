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
                        ServantCount = c.Servants.Count,
                        MemberCount  = c.ClassEnrollments.Count
                    })
                })
                .FirstOrDefaultAsync();

            if (g == null) return NotFound();
            return Ok(g);
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
