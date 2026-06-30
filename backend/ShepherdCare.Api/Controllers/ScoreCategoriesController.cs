using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.DTOs;
using ShepherdCare.Api.Models;
using System.Security.Claims;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/score-categories")]
    [Authorize]
    public class ScoreCategoriesController : ControllerBase
    {
        private readonly AppDbContext _db;

        private static readonly string[] AdminRoles = ["SuperAdmin", "ServiceLeader"];

        public ScoreCategoriesController(AppDbContext db) => _db = db;

        /// <summary>
        /// GET /api/score-categories
        /// Without params: all active categories (admin view).
        /// With ?classId=: global + class-specific + group-specific for that class's group.
        /// With ?groupId=: global + group-specific.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] Guid? classId, [FromQuery] Guid? groupId)
        {
            var query = _db.ScoreCategories.Where(c => c.IsActive);

            if (classId.HasValue)
            {
                // Resolve the group this class belongs to
                var classGroupId = await _db.Classes
                    .Where(c => c.Id == classId.Value)
                    .Select(c => c.GroupId)
                    .FirstOrDefaultAsync();

                query = query.Where(c =>
                    (c.ClassId == null && c.GroupId == null) ||   // global
                    c.ClassId == classId.Value ||                  // this class
                    (classGroupId != null && c.GroupId == classGroupId)); // this class's group
            }
            else if (groupId.HasValue)
            {
                query = query.Where(c =>
                    (c.ClassId == null && c.GroupId == null) ||   // global
                    c.GroupId == groupId.Value);                   // this group
            }
            // no filter = admin view, returns everything

            var categories = await query
                .OrderBy(c => c.IsPredefined ? 0 : 1)
                .ThenBy(c => c.ClassId == null && c.GroupId == null ? 0 : 1)
                .ThenBy(c => c.Name)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.Description,
                    c.MaxScore,
                    c.IsPredefined,
                    c.ClassId,
                    c.GroupId,
                    Scope = c.ClassId != null ? "class" : c.GroupId != null ? "group" : "global",
                    c.CreatedAt
                })
                .ToListAsync();

            return Ok(categories);
        }

        /// <summary>POST /api/score-categories — create category (admin roles)</summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ScoreCategoryCreateDto dto)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            if (!AdminRoles.Contains(role)) return Forbid();

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userId, out var createdById)) return Unauthorized();

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("Name is required.");

            // Name uniqueness scoped to same class/group/global bucket
            var exists = await _db.ScoreCategories.AnyAsync(c =>
                c.Name == dto.Name &&
                c.ClassId == dto.ClassId &&
                c.GroupId == dto.GroupId &&
                c.IsActive);
            if (exists) return BadRequest("A category with this name already exists in this scope.");

            var category = new ScoreCategory
            {
                Id = Guid.NewGuid(),
                Name = dto.Name.Trim(),
                Description = dto.Description,
                MaxScore = dto.MaxScore > 0 ? dto.MaxScore : 100,
                IsPredefined = dto.IsPredefined,
                ClassId = dto.ClassId,
                GroupId = dto.GroupId,
                IsActive = true,
                CreatedById = createdById,
                CreatedAt = DateTime.UtcNow
            };

            _db.ScoreCategories.Add(category);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                category.Id, category.Name, category.Description,
                category.MaxScore, category.IsPredefined,
                category.ClassId, category.GroupId,
                Scope = category.ClassId != null ? "class" : category.GroupId != null ? "group" : "global",
                category.CreatedAt
            });
        }

        /// <summary>PUT /api/score-categories/{id} — update category (admin roles)</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] ScoreCategoryUpdateDto dto)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            if (!AdminRoles.Contains(role)) return Forbid();

            var category = await _db.ScoreCategories.FindAsync(id);
            if (category == null || !category.IsActive) return NotFound();

            if (dto.Name != null)
            {
                var nameInUse = await _db.ScoreCategories.AnyAsync(c =>
                    c.Name == dto.Name && c.Id != id &&
                    c.ClassId == category.ClassId && c.GroupId == category.GroupId && c.IsActive);
                if (nameInUse) return BadRequest("A category with this name already exists in this scope.");
                category.Name = dto.Name.Trim();
            }
            if (dto.Description != null) category.Description = dto.Description;
            if (dto.MaxScore.HasValue && dto.MaxScore.Value > 0) category.MaxScore = dto.MaxScore.Value;
            if (dto.IsPredefined.HasValue) category.IsPredefined = dto.IsPredefined.Value;

            await _db.SaveChangesAsync();
            return Ok(new
            {
                category.Id, category.Name, category.Description,
                category.MaxScore, category.IsPredefined,
                category.ClassId, category.GroupId,
                Scope = category.ClassId != null ? "class" : category.GroupId != null ? "group" : "global"
            });
        }

        /// <summary>DELETE /api/score-categories/{id} — soft delete (admin roles)</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            if (!AdminRoles.Contains(role)) return Forbid();

            var category = await _db.ScoreCategories.FindAsync(id);
            if (category == null || !category.IsActive) return NotFound();

            category.IsActive = false;
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
