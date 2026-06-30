using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using System.Security.Claims;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AuditController : ControllerBase
    {
        private readonly AppDbContext _db;

        public AuditController(AppDbContext db)
        {
            _db = db;
        }

        /// <summary>GET /api/audit — paginated audit log, SuperAdmin only</summary>
        [HttpGet]
        public async Task<IActionResult> GetAuditLogs(
            [FromQuery] string? search,
            [FromQuery] string? action,
            [FromQuery] string? entity,
            [FromQuery] string? performedBy,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            if (userRole != "SuperAdmin")
                return Forbid();

            var query = _db.AuditLogs.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(a =>
                    a.Action.Contains(search) ||
                    a.PerformedBy.Contains(search) ||
                    a.Entity.Contains(search) ||
                    a.Details.Contains(search));

            if (!string.IsNullOrWhiteSpace(action))
                query = query.Where(a => a.Action == action);

            if (!string.IsNullOrWhiteSpace(entity))
                query = query.Where(a => a.Entity == entity);

            if (!string.IsNullOrWhiteSpace(performedBy))
                query = query.Where(a => a.PerformedBy.Contains(performedBy));

            if (from.HasValue)
                query = query.Where(a => a.Timestamp >= from.Value);

            if (to.HasValue)
                query = query.Where(a => a.Timestamp <= to.Value.AddDays(1));

            var total = await query.CountAsync();

            var items = await query
                .OrderByDescending(a => a.Timestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new
                {
                    a.Id,
                    a.Timestamp,
                    a.Action,
                    a.PerformedBy,
                    a.Entity,
                    a.EntityId,
                    a.Details
                })
                .ToListAsync();

            // Distinct values for filter dropdowns
            var actions  = await _db.AuditLogs.Select(a => a.Action).Distinct().OrderBy(x => x).ToListAsync();
            var entities = await _db.AuditLogs.Select(a => a.Entity).Distinct().OrderBy(x => x).ToListAsync();

            return Ok(new { items, total, page, pageSize, actions, entities });
        }

        /// <summary>GET /api/audit/{id} — full entry + current entity data, SuperAdmin only</summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetAuditEntry(Guid id)
        {
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            if (userRole != "SuperAdmin")
                return Forbid();

            var entry = await _db.AuditLogs.FindAsync(id);
            if (entry == null) return NotFound();

            object? entityData = null;
            string? navLink = null;

            if (Guid.TryParse(entry.EntityId, out var entityGuid))
            {
                switch (entry.Entity)
                {
                    case "Family":
                        var family = await _db.Families
                            .Where(f => f.Id == entityGuid)
                            .Select(f => new { f.Id, f.FamilyName, f.PhoneNumbers, f.Address, f.Area, f.Status })
                            .FirstOrDefaultAsync();
                        entityData = family;
                        navLink = family != null ? $"/families/{entityGuid}" : null;
                        break;

                    case "FamilyMember":
                        var member = await _db.FamilyMembers
                            .Include(m => m.Family)
                            .Where(m => m.Id == entityGuid)
                            .Select(m => new {
                                m.Id, m.FullName, m.Relation, m.Gender,
                                m.Mobile, m.IsChild, m.Notes,
                                FamilyId  = m.FamilyId,
                                FamilyName = m.Family != null ? m.Family.FamilyName : null
                            })
                            .FirstOrDefaultAsync();
                        entityData = member;
                        navLink = member != null ? $"/families/{member.FamilyId}" : null;
                        break;

                    case "User":
                        var user = await _db.Users
                            .Include(u => u.Role)
                            .Where(u => u.Id == entityGuid)
                            .Select(u => new { u.Id, u.Username, u.DisplayName, u.IsActive, Role = u.Role != null ? u.Role.Name : null })
                            .FirstOrDefaultAsync();
                        entityData = user;
                        navLink = "/users";
                        break;

                    case "Class":
                        var cls = await _db.Classes
                            .Where(c => c.Id == entityGuid)
                            .Select(c => new { c.Id, c.ClassName })
                            .FirstOrDefaultAsync();
                        entityData = cls;
                        navLink = cls != null ? $"/classes/{entityGuid}" : null;
                        break;

                    case "Group":
                        var group = await _db.Groups
                            .Where(g => g.Id == entityGuid)
                            .Select(g => new { g.Id, g.Name })
                            .FirstOrDefaultAsync();
                        entityData = group;
                        navLink = "/groups";
                        break;

                    case "AttendanceRecord":
                        var rec = await _db.AttendanceRecords
                            .Include(a => a.Member)
                            .Where(a => a.Id == entityGuid)
                            .Select(a => new {
                                a.Id, a.Date, a.AttendanceType, a.Notes,
                                MemberName = a.Member != null ? a.Member.FullName : null
                            })
                            .FirstOrDefaultAsync();
                        entityData = rec;
                        break;
                }
            }

            return Ok(new
            {
                entry.Id,
                entry.Timestamp,
                entry.Action,
                entry.PerformedBy,
                entry.Entity,
                entry.EntityId,
                entry.Details,
                CurrentEntityData = entityData,
                NavLink = navLink
            });
        }
    }
}
