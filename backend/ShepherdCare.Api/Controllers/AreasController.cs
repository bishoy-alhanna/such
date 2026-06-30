using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AreasController : ControllerBase
    {
        private readonly AppDbContext _db;
        public AreasController(AppDbContext db) => _db = db;

        // ── GET /api/areas  (all roles — used by family form dropdowns) ──────
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var areas = await _db.Areas
                .OrderBy(a => a.Name)
                .Select(a => new
                {
                    a.Id,
                    a.Name,
                    a.Color,
                    a.BoundaryJson,
                    Streets = a.Streets.OrderBy(s => s.Name).Select(s => new
                    {
                        s.Id,
                        s.Name,
                        Buildings = s.Buildings.OrderBy(b => b.Name).Select(b => new { b.Id, b.Name })
                    })
                })
                .ToListAsync();
            return Ok(areas);
        }

        // ── POST /api/areas  (SuperAdmin only) ───────────────────────────────
        [HttpPost]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> Create([FromBody] AreaDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("Name is required.");
            if (await _db.Areas.AnyAsync(a => a.Name == dto.Name))
                return Conflict("Area already exists.");

            var area = new Area
            {
                Id = Guid.NewGuid(),
                Name = dto.Name.Trim(),
                Color = string.IsNullOrWhiteSpace(dto.Color) ? "#6366f1" : dto.Color,
                BoundaryJson = dto.BoundaryJson
            };
            _db.Areas.Add(area);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetAll), new { }, new { area.Id, area.Name, area.Color, area.BoundaryJson, Streets = Array.Empty<object>() });
        }

        // ── PUT /api/areas/{id}  (SuperAdmin only) ───────────────────────────
        [HttpPut("{id}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> Update(Guid id, [FromBody] AreaDto dto)
        {
            var area = await _db.Areas.FindAsync(id);
            if (area == null) return NotFound();
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");
            if (await _db.Areas.AnyAsync(a => a.Name == dto.Name && a.Id != id))
                return Conflict("Another area with that name already exists.");

            area.Name = dto.Name.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Color)) area.Color = dto.Color;
            if (dto.BoundaryJson != null) area.BoundaryJson = dto.BoundaryJson;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── PUT /api/areas/{id}/boundary  (SuperAdmin only) ──────────────────
        [HttpPut("{id}/boundary")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> SetBoundary(Guid id, [FromBody] BoundaryDto dto)
        {
            var area = await _db.Areas.FindAsync(id);
            if (area == null) return NotFound();
            area.BoundaryJson = dto.BoundaryJson;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── DELETE /api/areas/{id}  (SuperAdmin only) ────────────────────────
        [HttpDelete("{id}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var area = await _db.Areas.FindAsync(id);
            if (area == null) return NotFound();
            _db.Areas.Remove(area);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── POST /api/areas/{id}/streets  (SuperAdmin only) ──────────────────
        [HttpPost("{id}/streets")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> AddStreet(Guid id, [FromBody] StreetDto dto)
        {
            if (!await _db.Areas.AnyAsync(a => a.Id == id)) return NotFound("Area not found.");
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");
            if (await _db.Streets.AnyAsync(s => s.AreaId == id && s.Name == dto.Name))
                return Conflict("Street already exists in this area.");

            var street = new Street { Id = Guid.NewGuid(), AreaId = id, Name = dto.Name.Trim() };
            _db.Streets.Add(street);
            await _db.SaveChangesAsync();
            return Ok(new { street.Id, street.Name });
        }

        // ── POST /api/areas/{id}/streets/bulk  (SuperAdmin only) ─────────────
        [HttpPost("{id}/streets/bulk")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> BulkAddStreets(Guid id, [FromBody] BulkStreetsDto dto)
        {
            if (!await _db.Areas.AnyAsync(a => a.Id == id)) return NotFound("Area not found.");

            var existingList = await _db.Streets
                .Where(s => s.AreaId == id)
                .Select(s => s.Name)
                .ToListAsync();
            var existing = new HashSet<string>(existingList);

            var toAdd = dto.Names
                .Select(n => n.Trim())
                .Where(n => !string.IsNullOrEmpty(n) && !existing.Contains(n))
                .Distinct()
                .ToList();

            var newStreets = new Dictionary<string, Street>();
            foreach (var name in toAdd)
            {
                var s = new Street { Id = Guid.NewGuid(), AreaId = id, Name = name };
                _db.Streets.Add(s);
                newStreets[name] = s;
            }
            await _db.SaveChangesAsync();

            // Save buildings for each street (new or existing)
            if (dto.Buildings.Count > 0)
            {
                foreach (var (streetName, buildingNames) in dto.Buildings)
                {
                    var street = newStreets.TryGetValue(streetName, out var ns)
                        ? ns
                        : await _db.Streets.FirstOrDefaultAsync(s => s.AreaId == id && s.Name == streetName);
                    if (street == null) continue;

                    var existingBldgs = new HashSet<string>(
                        await _db.Buildings.Where(b => b.StreetId == street.Id).Select(b => b.Name).ToListAsync());

                    foreach (var bName in buildingNames
                        .Select(n => n.Trim()).Where(n => !string.IsNullOrEmpty(n) && !existingBldgs.Contains(n)).Distinct())
                    {
                        _db.Buildings.Add(new Building { Id = Guid.NewGuid(), StreetId = street.Id, Name = bName });
                    }
                }
                await _db.SaveChangesAsync();
            }

            var streets = await _db.Streets
                .Where(s => s.AreaId == id)
                .OrderBy(s => s.Name)
                .Select(s => new {
                    s.Id, s.Name,
                    Buildings = s.Buildings.OrderBy(b => b.Name).Select(b => new { b.Id, b.Name })
                })
                .ToListAsync();

            return Ok(new { imported = toAdd.Count, streets });
        }

        // ── POST /api/areas/{id}/streets/{streetId}/buildings  (SuperAdmin only) ─
        [HttpPost("{id}/streets/{streetId}/buildings")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> AddBuilding(Guid id, Guid streetId, [FromBody] BuildingDto dto)
        {
            var street = await _db.Streets.FirstOrDefaultAsync(s => s.Id == streetId && s.AreaId == id);
            if (street == null) return NotFound("Street not found.");
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");
            if (await _db.Buildings.AnyAsync(b => b.StreetId == streetId && b.Name == dto.Name))
                return Conflict("Building already exists on this street.");

            var building = new Building { Id = Guid.NewGuid(), StreetId = streetId, Name = dto.Name.Trim() };
            _db.Buildings.Add(building);
            await _db.SaveChangesAsync();
            return Ok(new { building.Id, building.Name });
        }

        // ── DELETE /api/areas/{id}/streets/{streetId}/buildings/{buildingId}  ─
        [HttpDelete("{id}/streets/{streetId}/buildings/{buildingId}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> DeleteBuilding(Guid id, Guid streetId, Guid buildingId)
        {
            var building = await _db.Buildings.FirstOrDefaultAsync(b => b.Id == buildingId && b.StreetId == streetId);
            if (building == null) return NotFound();
            _db.Buildings.Remove(building);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── PUT /api/areas/{id}/streets/{streetId}  (SuperAdmin only) ────────
        [HttpPut("{id}/streets/{streetId}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> UpdateStreet(Guid id, Guid streetId, [FromBody] StreetDto dto)
        {
            var street = await _db.Streets.FirstOrDefaultAsync(s => s.Id == streetId && s.AreaId == id);
            if (street == null) return NotFound();
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");
            if (await _db.Streets.AnyAsync(s => s.AreaId == id && s.Name == dto.Name && s.Id != streetId))
                return Conflict("Another street with that name already exists in this area.");

            street.Name = dto.Name.Trim();
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── DELETE /api/areas/{id}/streets/{streetId}  (SuperAdmin only) ─────
        [HttpDelete("{id}/streets/{streetId}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> DeleteStreet(Guid id, Guid streetId)
        {
            var street = await _db.Streets.FirstOrDefaultAsync(s => s.Id == streetId && s.AreaId == id);
            if (street == null) return NotFound();
            _db.Streets.Remove(street);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }

    public class AreaDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Color { get; set; }
        public string? BoundaryJson { get; set; }
    }
    public class StreetDto     { public string Name { get; set; } = string.Empty; }
    public class BuildingDto   { public string Name { get; set; } = string.Empty; }
    public class BoundaryDto   { public string? BoundaryJson { get; set; } }
    public class BulkStreetsDto
    {
        public List<string> Names { get; set; } = new();
        public Dictionary<string, List<string>> Buildings { get; set; } = new();
    }
}
