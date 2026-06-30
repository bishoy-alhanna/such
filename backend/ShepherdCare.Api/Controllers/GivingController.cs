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
    [Route("api/giving")]
    [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest")]
    public class GivingController : ControllerBase
    {
        private readonly AppDbContext _db;
        public GivingController(AppDbContext db) => _db = db;

        // ── Giving records ───────────────────────────────────────────────────

        /// <summary>GET /api/giving?familyId=&year= — giving records</summary>
        [HttpGet]
        public async Task<IActionResult> GetRecords([FromQuery] Guid? familyId, [FromQuery] int? year)
        {
            var q = _db.GivingRecords.Include(g => g.Family).AsQueryable();
            if (familyId.HasValue) q = q.Where(g => g.FamilyId == familyId.Value);
            if (year.HasValue)
                q = q.Where(g => g.Date.Year == year.Value);

            var records = await q.OrderByDescending(g => g.Date).ToListAsync();
            return Ok(records.Select(g => new {
                g.Id, g.FamilyId, FamilyName = g.Family?.FamilyName ?? "",
                g.Amount, Date = g.Date.ToString("yyyy-MM-dd"),
                g.Type, g.Notes, g.IsConfidential, g.CreatedAt,
            }));
        }

        /// <summary>POST /api/giving — create giving record</summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] GivingCreateDto dto)
        {
            if (!await _db.Families.AnyAsync(f => f.Id == dto.FamilyId))
                return NotFound("Family not found.");

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            Guid.TryParse(userId, out var uid);

            var record = new GivingRecord
            {
                FamilyId      = dto.FamilyId,
                Amount        = dto.Amount,
                Date          = dto.Date.Date,
                Type          = dto.Type,
                Notes         = dto.Notes,
                IsConfidential = dto.IsConfidential,
                RecordedById  = uid,
            };
            _db.GivingRecords.Add(record);
            await _db.SaveChangesAsync();
            return Ok(new { record.Id });
        }

        /// <summary>PUT /api/giving/{id} — update record</summary>
        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] GivingCreateDto dto)
        {
            var record = await _db.GivingRecords.FindAsync(id);
            if (record == null) return NotFound();
            record.Amount        = dto.Amount;
            record.Date          = dto.Date.Date;
            record.Type          = dto.Type;
            record.Notes         = dto.Notes;
            record.IsConfidential = dto.IsConfidential;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>DELETE /api/giving/{id}</summary>
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var record = await _db.GivingRecords.FindAsync(id);
            if (record == null) return NotFound();
            _db.GivingRecords.Remove(record);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>GET /api/giving/summary?familyId=&year= — totals by type + pledge progress</summary>
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary([FromQuery] Guid familyId, [FromQuery] int? year)
        {
            var y = year ?? DateTime.UtcNow.Year;
            var records = await _db.GivingRecords
                .Where(g => g.FamilyId == familyId && g.Date.Year == y)
                .ToListAsync();

            var pledge = await _db.Pledges
                .FirstOrDefaultAsync(p => p.FamilyId == familyId && p.Year == y && p.IsActive);

            var byType = records.GroupBy(r => r.Type)
                .Select(g => new { type = g.Key, total = g.Sum(r => r.Amount) });

            return Ok(new {
                year = y,
                totalGiven    = records.Sum(r => r.Amount),
                pledgedAmount = pledge?.PledgedAmount ?? 0,
                pledgeId      = pledge?.Id,
                byType,
            });
        }

        // ── Pledges ──────────────────────────────────────────────────────────

        /// <summary>GET /api/giving/pledges?familyId=</summary>
        [HttpGet("pledges")]
        public async Task<IActionResult> GetPledges([FromQuery] Guid? familyId)
        {
            var q = _db.Pledges.Include(p => p.Family).AsQueryable();
            if (familyId.HasValue) q = q.Where(p => p.FamilyId == familyId.Value);
            var pledges = await q.OrderByDescending(p => p.Year).ToListAsync();
            return Ok(pledges.Select(p => new {
                p.Id, p.FamilyId, FamilyName = p.Family?.FamilyName ?? "",
                p.Year, p.PledgedAmount, p.Notes, p.IsActive, p.CreatedAt,
            }));
        }

        /// <summary>POST /api/giving/pledges — create or update pledge for a year</summary>
        [HttpPost("pledges")]
        public async Task<IActionResult> UpsertPledge([FromBody] PledgeDto dto)
        {
            if (!await _db.Families.AnyAsync(f => f.Id == dto.FamilyId))
                return NotFound("Family not found.");

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            Guid.TryParse(userId, out var uid);

            var existing = await _db.Pledges.FirstOrDefaultAsync(p => p.FamilyId == dto.FamilyId && p.Year == dto.Year);
            if (existing != null)
            {
                existing.PledgedAmount = dto.PledgedAmount;
                existing.Notes         = dto.Notes;
                existing.IsActive      = dto.IsActive;
            }
            else
            {
                _db.Pledges.Add(new Pledge {
                    FamilyId      = dto.FamilyId,
                    Year          = dto.Year,
                    PledgedAmount = dto.PledgedAmount,
                    Notes         = dto.Notes,
                    IsActive      = dto.IsActive,
                    CreatedById   = uid,
                });
            }
            await _db.SaveChangesAsync();
            return Ok();
        }

        /// <summary>DELETE /api/giving/pledges/{id}</summary>
        [HttpDelete("pledges/{id:guid}")]
        public async Task<IActionResult> DeletePledge(Guid id)
        {
            var p = await _db.Pledges.FindAsync(id);
            if (p == null) return NotFound();
            _db.Pledges.Remove(p);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>GET /api/giving/report?year= — church-wide aggregate (admin/priest)</summary>
        [HttpGet("report")]
        public async Task<IActionResult> GetReport([FromQuery] int? year)
        {
            var y = year ?? DateTime.UtcNow.Year;
            var records = await _db.GivingRecords
                .Include(g => g.Family)
                .Where(g => g.Date.Year == y)
                .ToListAsync();

            var totalGiven     = records.Sum(r => r.Amount);
            var totalPledged   = await _db.Pledges.Where(p => p.Year == y && p.IsActive).SumAsync(p => p.PledgedAmount);
            var familiesCount  = records.Select(r => r.FamilyId).Distinct().Count();

            var byType = records.GroupBy(r => r.Type)
                .Select(g => new { type = g.Key, total = g.Sum(r => r.Amount), count = g.Count() })
                .OrderByDescending(x => x.total).ToList();

            var byMonth = records.GroupBy(r => r.Date.Month)
                .Select(g => new { month = g.Key, total = g.Sum(r => r.Amount) })
                .OrderBy(x => x.month).ToList();

            var topFamilies = records
                .GroupBy(r => new { r.FamilyId, Name = r.Family != null ? r.Family.FamilyName : "" })
                .Select(g => new { familyId = g.Key.FamilyId, familyName = g.Key.Name, total = g.Sum(r => r.Amount) })
                .OrderByDescending(x => x.total)
                .Take(10).ToList();

            return Ok(new { year = y, totalGiven, totalPledged, familiesCount, byType, byMonth, topFamilies });
        }
    }

    public class GivingCreateDto
    {
        public Guid     FamilyId      { get; set; }
        public decimal  Amount        { get; set; }
        public DateTime Date          { get; set; } = DateTime.UtcNow;
        public string   Type          { get; set; } = "Tithe";
        public string?  Notes         { get; set; }
        public bool     IsConfidential { get; set; } = true;
    }

    public class PledgeDto
    {
        public Guid    FamilyId      { get; set; }
        public int     Year          { get; set; }
        public decimal PledgedAmount { get; set; }
        public string? Notes         { get; set; }
        public bool    IsActive      { get; set; } = true;
    }
}
