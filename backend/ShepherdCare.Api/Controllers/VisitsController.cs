using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;
using ShepherdCare.Api.Services;
using System.Security.Claims;

namespace ShepherdCare.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VisitsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAuditService _audit;

    public VisitsController(AppDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    /// <summary>GET /api/visits — list all visits with filters</summary>
    [HttpGet]
    public async Task<IActionResult> GetVisits(
        [FromQuery] Guid? familyId,
        [FromQuery] Guid? memberId,
        [FromQuery] string? visitType,
        [FromQuery] string? targetType,
        [FromQuery] string? visitorType,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _db.Visits
            .Include(v => v.Family)
            .Include(v => v.Member)
            .Include(v => v.VisitorUser)
            .AsQueryable();

        // Get current user ID and role
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var userRole = User.FindFirstValue(ClaimTypes.Role);
        
        // If user is a Servant, only show visits for members in their classes
        if (userRole == "Servant" && !string.IsNullOrEmpty(userId) && Guid.TryParse(userId, out var currentUserId))
        {
            var servantClassIds = await _db.Servants
                .Where(s => s.UserId == currentUserId)
                .Select(s => s.ClassId)
                .ToListAsync();
                
            var enrolledMemberIds = await _db.ClassEnrollments
                .Where(e => servantClassIds.Contains(e.ClassId))
                .Select(e => e.MemberId)
                .ToListAsync();
                
            // Filter visits to only those for members in servant's classes
            query = query.Where(v => v.MemberId != null && enrolledMemberIds.Contains(v.MemberId.Value));
        }

        if (familyId.HasValue)
            query = query.Where(v => v.FamilyId == familyId.Value);

        if (memberId.HasValue)
            query = query.Where(v => v.MemberId == memberId.Value);

        if (!string.IsNullOrWhiteSpace(visitType))
            query = query.Where(v => v.VisitType == visitType);

        if (!string.IsNullOrWhiteSpace(targetType))
            query = query.Where(v => v.TargetType == targetType);

        if (!string.IsNullOrWhiteSpace(visitorType))
            query = query.Where(v => v.VisitorType == visitorType);

        if (fromDate.HasValue)
            query = query.Where(v => v.VisitDate >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(v => v.VisitDate <= toDate.Value);

        var total = await query.CountAsync();
        var visits = await query
            .OrderByDescending(v => v.VisitDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(v => new
            {
                v.Id,
                v.VisitType,
                v.TargetType,
                v.VisitorType,
                v.MemberId,
                MemberName = v.Member != null ? v.Member.FullName : null,
                v.FamilyId,
                FamilyName = v.Family != null ? v.Family.FamilyName : null,
                v.VisitorUserId,
                VisitorName = v.VisitorUser != null ? v.VisitorUser.DisplayName : null,
                v.VisitDate,
                v.Notes,
                v.Purpose,
                v.Outcome,
                v.NextActionDate,
                v.FollowUpRequired,
                v.CreatedAt,
                v.UpdatedAt
            })
            .ToListAsync();

        return Ok(new { Total = total, Page = page, PageSize = pageSize, Items = visits });
    }

    /// <summary>GET /api/visits/{id} — get single visit</summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetVisit(Guid id)
    {
        var visit = await _db.Visits
            .Include(v => v.Family)
            .Include(v => v.Member)
            .Include(v => v.VisitorUser)
            .Where(v => v.Id == id)
            .Select(v => new
            {
                v.Id,
                v.VisitType,
                v.TargetType,
                v.VisitorType,
                v.MemberId,
                MemberName = v.Member != null ? v.Member.FullName : null,
                v.FamilyId,
                FamilyName = v.Family != null ? v.Family.FamilyName : null,
                v.VisitorUserId,
                VisitorName = v.VisitorUser != null ? v.VisitorUser.DisplayName : null,
                v.VisitDate,
                v.Notes,
                v.Purpose,
                v.Outcome,
                v.NextActionDate,
                v.FollowUpRequired,
                v.CreatedAt,
                v.UpdatedAt
            })
            .FirstOrDefaultAsync();

        if (visit == null) return NotFound();
        return Ok(visit);
    }

    /// <summary>POST /api/visits — create new visit</summary>
    [HttpPost]
    [Authorize(Roles = "SuperAdmin,Priest,SeniorPriest,ServiceLeader,Servant")]
    public async Task<IActionResult> CreateVisit([FromBody] CreateVisitDto dto)
    {
        // Validation
        if (string.IsNullOrWhiteSpace(dto.VisitType) || !new[] { "HomeVisit", "PhoneCall", "WhatsApp", "Message", "InPerson" }.Contains(dto.VisitType))
            return BadRequest("Invalid VisitType.");

        if (string.IsNullOrWhiteSpace(dto.TargetType) || !new[] { "Member", "Family" }.Contains(dto.TargetType))
            return BadRequest("TargetType must be 'Member' or 'Family'.");

        if (string.IsNullOrWhiteSpace(dto.VisitorType) || !new[] { "Servant", "Priest" }.Contains(dto.VisitorType))
            return BadRequest("VisitorType must be 'Servant' or 'Priest'.");

        if (dto.TargetType == "Member" && !dto.MemberId.HasValue)
            return BadRequest("MemberId is required when TargetType is 'Member'.");

        if (dto.TargetType == "Family" && !dto.FamilyId.HasValue)
            return BadRequest("FamilyId is required when TargetType is 'Family'.");

        // Get current user ID and role
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var userRole = User.FindFirstValue(ClaimTypes.Role);
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var visitorUserId))
            return Unauthorized();

        // If user is a Servant, validate they can only create visits for members in their classes
        if (userRole == "Servant" && dto.TargetType == "Member" && dto.MemberId.HasValue)
        {
            var servantClassIds = await _db.Servants
                .Where(s => s.UserId == visitorUserId)
                .Select(s => s.ClassId)
                .ToListAsync();
                
            var isMemberInServantClass = await _db.ClassEnrollments
                .AnyAsync(e => e.MemberId == dto.MemberId.Value && servantClassIds.Contains(e.ClassId));
                
            if (!isMemberInServantClass)
            {
                return Forbid("You can only create visits for members in your assigned classes.");
            }
        }
        
        // Servants cannot create family visits
        if (userRole == "Servant" && dto.TargetType == "Family")
        {
            return Forbid("Servants can only create visits for members, not families.");
        }

        var visit = new Visit
        {
            Id = Guid.NewGuid(),
            VisitType = dto.VisitType,
            TargetType = dto.TargetType,
            VisitorType = dto.VisitorType,
            MemberId = dto.MemberId,
            FamilyId = dto.FamilyId,
            VisitorUserId = visitorUserId,
            VisitDate = dto.VisitDate,
            Notes = dto.Notes?.Trim(),
            Purpose = dto.Purpose?.Trim(),
            Outcome = dto.Outcome?.Trim(),
            NextActionDate = dto.NextActionDate,
            FollowUpRequired = dto.FollowUpRequired,
            CreatedAt = DateTime.UtcNow
        };

        _db.Visits.Add(visit);
        await _db.SaveChangesAsync();
        await _audit.LogAsync(new AuditLog
        {
            Action = "CreateVisit",
            PerformedBy = User.Identity?.Name ?? "system",
            Entity = "Visit",
            EntityId = visit.Id.ToString(),
            Details = $"{visit.VisitType} - {visit.TargetType}"
        });

        return CreatedAtAction(nameof(GetVisit), new { id = visit.Id }, new { visit.Id });
    }

    /// <summary>PUT /api/visits/{id} — update visit</summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "SuperAdmin,Priest,SeniorPriest,ServiceLeader,Servant")]
    public async Task<IActionResult> UpdateVisit(Guid id, [FromBody] UpdateVisitDto dto)
    {
        var visit = await _db.Visits.FindAsync(id);
        if (visit == null) return NotFound();

        visit.VisitDate = dto.VisitDate;
        visit.Notes = dto.Notes?.Trim();
        visit.Purpose = dto.Purpose?.Trim();
        visit.Outcome = dto.Outcome?.Trim();
        visit.NextActionDate = dto.NextActionDate;
        visit.FollowUpRequired = dto.FollowUpRequired;
        visit.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        await _audit.LogAsync(new AuditLog
        {
            Action = "UpdateVisit",
            PerformedBy = User.Identity?.Name ?? "system",
            Entity = "Visit",
            EntityId = visit.Id.ToString()
        });

        return Ok(new { visit.Id });
    }

    /// <summary>DELETE /api/visits/{id} — delete visit</summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "SuperAdmin,Priest,SeniorPriest")]
    public async Task<IActionResult> DeleteVisit(Guid id)
    {
        var visit = await _db.Visits.FindAsync(id);
        if (visit == null) return NotFound();

        _db.Visits.Remove(visit);
        await _db.SaveChangesAsync();
        await _audit.LogAsync(new AuditLog
        {
            Action = "DeleteVisit",
            PerformedBy = User.Identity?.Name ?? "system",
            Entity = "Visit",
            EntityId = id.ToString()
        });

        return NoContent();
    }

    /// <summary>GET /api/visits/available-members — get members that current user can visit</summary>
    [HttpGet("available-members")]
    public async Task<IActionResult> GetAvailableMembers()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var userRole = User.FindFirstValue(ClaimTypes.Role);
        
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var currentUserId))
            return Unauthorized();

        // If user is a Servant, only return members in their classes
        if (userRole == "Servant")
        {
            var servantClassIds = await _db.Servants
                .Where(s => s.UserId == currentUserId)
                .Select(s => s.ClassId)
                .ToListAsync();
                
            var members = await _db.ClassEnrollments
                .Where(e => servantClassIds.Contains(e.ClassId))
                .Include(e => e.Member)
                .Select(e => new
                {
                    e.Member.Id,
                    e.Member.FullName,
                    e.Member.FamilyId
                })
                .Distinct()
                .OrderBy(m => m.FullName)
                .ToListAsync();
                
            return Ok(members);
        }
        
        // For other roles (Priest, Admin), return all members
        var allMembers = await _db.FamilyMembers
            .Select(m => new
            {
                m.Id,
                m.FullName,
                m.FamilyId
            })
            .OrderBy(m => m.FullName)
            .ToListAsync();
            
        return Ok(allMembers);
    }
}

// DTOs
public class CreateVisitDto
{
    public string VisitType { get; set; } = string.Empty; // HomeVisit, PhoneCall
    public string TargetType { get; set; } = string.Empty; // Member, Family
    public string VisitorType { get; set; } = string.Empty; // Servant, Priest
    public Guid? MemberId { get; set; }
    public Guid? FamilyId { get; set; }
    public DateTime VisitDate { get; set; }
    public string? Notes { get; set; }
    public string? Purpose { get; set; }
    public string? Outcome { get; set; }
    public DateTime? NextActionDate { get; set; }
    public bool FollowUpRequired { get; set; }
}

public class UpdateVisitDto
{
    public DateTime VisitDate { get; set; }
    public string? Notes { get; set; }
    public string? Purpose { get; set; }
    public string? Outcome { get; set; }
    public DateTime? NextActionDate { get; set; }
    public bool FollowUpRequired { get; set; }
}
