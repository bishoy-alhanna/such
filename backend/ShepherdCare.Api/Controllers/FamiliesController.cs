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
    public class FamiliesController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IAuditService _audit;

        public FamiliesController(AppDbContext db, IAuditService audit)
        {
            _db = db;
            _audit = audit;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            
            var query = _db.Families.Include(f => f.Members).AsQueryable();
            
            // If user is a Servant, filter to only families with members in their classes
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
                    
                query = query.Where(f => f.Members.Any(m => enrolledMemberIds.Contains(m.Id)));
            }
            
            // Members can only see their own family
            if (userRole == "Member" && !string.IsNullOrEmpty(userId) && Guid.TryParse(userId, out var memberId))
            {
                var user = await _db.Users.FindAsync(memberId);
                if (user?.FamilyMemberId == null) return Ok(new PagedResponse<object> { Items = new List<object>(), Page = 1, PageSize = pageSize, TotalCount = 0 });
                var memberRecord = await _db.FamilyMembers.FindAsync(user.FamilyMemberId.Value);
                if (memberRecord == null) return Ok(new PagedResponse<object> { Items = new List<object>(), Page = 1, PageSize = pageSize, TotalCount = 0 });
                query = query.Where(f => f.Id == memberRecord.FamilyId);
            }

            if (!string.IsNullOrWhiteSpace(q))
            {
                query = query.Where(f => f.FamilyName.Contains(q));
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderBy(f => f.FamilyName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(f => new
                {
                    f.Id,
                    f.FamilyName,
                    f.Address,
                    f.Area,
                    // Hide phone numbers for Servants
                    PhoneNumbers = userRole == "Servant" ? null : f.PhoneNumbers,
                    f.AssignedPriestId,
                    f.Status,
                    MemberCount = f.Members.Count
                })
                .ToListAsync();

            var resp = new PagedResponse<object>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = total
            };

            return Ok(resp);
        }

        [HttpPost]
        [Authorize(Roles = "SuperAdmin,DataEntry,Priest,ServiceLeader")]
        public async Task<IActionResult> Create(FamilyCreateDto dto)
        {
            var f = new Family
            {
                FamilyName = dto.FamilyName,
                Address = dto.Address,
                Area = dto.Area,
                PhoneNumbers = dto.PhoneNumbers,
                AssignedPriestId = dto.AssignedPriestId,
                Status = dto.Status,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude
            };
            _db.Families.Add(f);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "CreateFamily", PerformedBy = User.Identity?.Name ?? "system", Entity = "Family", EntityId = f.Id.ToString(), Details = f.FamilyName });

            return CreatedAtAction(nameof(GetById), new { id = f.Id }, new
            {
                f.Id,
                f.FamilyName,
                f.Address,
                f.Area,
                f.PhoneNumbers,
                f.AssignedPriestId,
                f.Status,
                f.Latitude,
                f.Longitude
            });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            
            var f = await _db.Families.Include(x => x.Members).FirstOrDefaultAsync(x => x.Id == id);
            if (f == null) return NotFound();
            
            // Member: only allow their own family
            if (userRole == "Member" && !string.IsNullOrEmpty(userId) && Guid.TryParse(userId, out var memberUserId))
            {
                var memberUser = await _db.Users.FindAsync(memberUserId);
                var memberRecord = memberUser?.FamilyMemberId != null ? await _db.FamilyMembers.FindAsync(memberUser.FamilyMemberId.Value) : null;
                if (memberRecord == null || memberRecord.FamilyId != id) return Forbid();
            }

            // If user is a Servant, verify they have at least one member in their classes
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
                    
                var hasAccess = f.Members.Any(m => enrolledMemberIds.Contains(m.Id));
                if (!hasAccess)
                {
                    return Forbid("You can only view families with members in your assigned classes.");
                }
                
                // For servants, hide phone numbers from family and filter sensitive member data
                var filteredMembers = f.Members.Select(m =>
                {
                    var isInServantClass = enrolledMemberIds.Contains(m.Id);
                    var isHeadOrSpouse = m.Relation?.ToLower() == "head" || 
                                        m.Relation?.ToLower() == "father" || 
                                        m.Relation?.ToLower() == "spouse" || 
                                        m.Relation?.ToLower() == "mother";
                    
                    // Only show mobile for: class members, head, or spouse
                    var mobile = (isInServantClass || isHeadOrSpouse) ? m.Mobile : null;
                    
                    return new
                    {
                        m.Id,
                        m.FullName,
                        m.Relation,
                        m.Gender,
                        m.DateOfBirth,
                        Mobile = mobile,
                        m.NationalId,
                        m.IsChild,
                        m.Notes,
                        m.FamilyId
                    };
                }).ToList();
                
                return Ok(new
                {
                    f.Id,
                    f.FamilyName,
                    f.Address,
                    f.Area,
                    PhoneNumbers = (string?)null,  // Hide family phone numbers
                    f.AssignedPriestId,
                    f.Status,
                    Members = filteredMembers
                });
            }
            
            // Build a primaryMemberId map: NationalId → the FamilyMember.Id that has a linked User
            var allNids = f.Members
                .Where(m => m.NationalId != null)
                .Select(m => m.NationalId!)
                .Distinct()
                .ToList();

            var primaryMap = new Dictionary<string, Guid>();
            if (allNids.Any())
            {
                var linked = await _db.Users
                    .Where(u => u.FamilyMemberId.HasValue)
                    .Join(_db.FamilyMembers,
                        u => u.FamilyMemberId!.Value,
                        fm => fm.Id,
                        (u, fm) => new { fm.NationalId, fm.Id })
                    .Where(x => x.NationalId != null && allNids.Contains(x.NationalId!))
                    .ToListAsync();

                foreach (var row in linked)
                    if (row.NationalId != null && !primaryMap.ContainsKey(row.NationalId))
                        primaryMap[row.NationalId] = row.Id;
            }

            return Ok(new
            {
                f.Id, f.FamilyName, f.Address, f.Area, f.PhoneNumbers,
                f.AssignedPriestId, f.Status, f.Latitude, f.Longitude,
                Members = f.Members.Select(m => new
                {
                    m.Id,
                    PrimaryMemberId = m.NationalId != null && primaryMap.TryGetValue(m.NationalId, out var pid) ? pid : m.Id,
                    m.FamilyId, m.FullName, m.Gender, m.DateOfBirth, m.Relation,
                    m.Mobile, m.IsChild, m.Notes, m.NationalId, m.OccupationStatus,
                    m.StudyYear, m.College, m.JobTitle, m.JobDetails, m.Qualification,
                    m.Church, m.MeetingAttended, m.ConfessionFather,
                    m.LastConfessionDate, m.LastCommunionDate, m.LastCallDate,
                    m.IsServant, m.ServiceType, m.Status, m.PhotoUrl, m.CreatedAt,
                }),
            });
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "SuperAdmin,DataEntry,Priest,ServiceLeader")]
        public async Task<IActionResult> Update(Guid id, FamilyCreateDto dto)
        {
            var f = await _db.Families.FindAsync(id);
            if (f == null) return NotFound();
            f.FamilyName = dto.FamilyName;
            f.Address = dto.Address;
            f.Area = dto.Area;
            f.PhoneNumbers = dto.PhoneNumbers;
            f.AssignedPriestId = dto.AssignedPriestId;
            f.Status = dto.Status;
            f.Latitude = dto.Latitude;
            f.Longitude = dto.Longitude;
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "UpdateFamily", PerformedBy = User.Identity?.Name ?? "system", Entity = "Family", EntityId = f.Id.ToString(), Details = f.FamilyName });

            return Ok(new
            {
                f.Id,
                f.FamilyName,
                f.Address,
                f.Area,
                f.PhoneNumbers,
                f.AssignedPriestId,
                f.Status,
                f.Latitude,
                f.Longitude
            });
        }

        [HttpGet("map-data")]
        public async Task<IActionResult> GetMapData()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            var query = _db.Families.Include(f => f.Members).AsQueryable();

            // Only SuperAdmin, Priest, and SeniorPriest see all families.
            // Everyone else is scoped to families with members in their class(es).
            var fullAccessRoles = new[] { "SuperAdmin", "Priest", "SeniorPriest" };
            if (!fullAccessRoles.Contains(userRole) &&
                !string.IsNullOrEmpty(userId) && Guid.TryParse(userId, out var currentUserId))
            {
                List<Guid> visibleMemberIds;

                if (userRole == "ServiceLeader")
                {
                    var groupIds = await _db.Groups
                        .Where(g => g.ServantUserId == currentUserId)
                        .Select(g => g.Id)
                        .ToListAsync();
                    var classIds = await _db.Classes
                        .Where(c => c.GroupId.HasValue && groupIds.Contains(c.GroupId.Value))
                        .Select(c => c.Id)
                        .ToListAsync();
                    visibleMemberIds = await _db.ClassEnrollments
                        .Where(e => classIds.Contains(e.ClassId))
                        .Select(e => e.MemberId)
                        .Distinct()
                        .ToListAsync();
                }
                else if (userRole == "Servant" || userRole == "DataEntry")
                {
                    var classIds = await _db.Servants
                        .Where(s => s.UserId == currentUserId)
                        .Select(s => s.ClassId)
                        .ToListAsync();
                    visibleMemberIds = await _db.ClassEnrollments
                        .Where(e => classIds.Contains(e.ClassId))
                        .Select(e => e.MemberId)
                        .Distinct()
                        .ToListAsync();
                }
                else if (userRole == "Member")
                {
                    var user = await _db.Users.FindAsync(currentUserId);
                    visibleMemberIds = user?.FamilyMemberId != null
                        ? new List<Guid> { user.FamilyMemberId.Value }
                        : new List<Guid>();
                }
                else
                {
                    visibleMemberIds = new List<Guid>();
                }

                query = visibleMemberIds.Count > 0
                    ? query.Where(f => f.Members.Any(m => visibleMemberIds.Contains(m.Id)))
                    : query.Where(f => false);
            }

            var families = await query
                .OrderBy(f => f.FamilyName)
                .Select(f => new {
                    f.Id,
                    f.FamilyName,
                    f.Address,
                    f.Area,
                    f.Latitude,
                    f.Longitude,
                    Members = f.Members.Select(m => m.FullName).ToList()
                })
                .ToListAsync();

            return Ok(families);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "SuperAdmin,DataEntry,Priest,ServiceLeader")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var f = await _db.Families.FindAsync(id);
            if (f == null) return NotFound();
            _db.Families.Remove(f);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "DeleteFamily", PerformedBy = User.Identity?.Name ?? "system", Entity = "Family", EntityId = f.Id.ToString(), Details = f.FamilyName });

            return NoContent();
        }

        // ── Family Links ─────────────────────────────────────────────────────

        /// <summary>GET /api/families/{id}/links — all related families for this family</summary>
        [HttpGet("{id}/links")]
        public async Task<IActionResult> GetLinks(Guid id)
        {
            // Return only outgoing links (since we always create bidirectional links)
            var links = await _db.FamilyLinks
                .Where(l => l.FamilyId == id)
                .Select(l => new
                {
                    l.Id,
                    LinkedFamilyId   = l.LinkedFamilyId,
                    LinkedFamilyName = l.LinkedFamily!.FamilyName,
                    l.RelationLabel,
                    Direction = "outgoing"
                }).ToListAsync();

            return Ok(links);
        }

        /// <summary>POST /api/families/{id}/links — link another family</summary>
        [HttpPost("{id}/links")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,DataEntry")]
        public async Task<IActionResult> AddLink(Guid id, [FromBody] FamilyLinkDto dto)
        {
            if (!await _db.Families.AnyAsync(f => f.Id == id))                 return NotFound("Family not found.");
            if (!await _db.Families.AnyAsync(f => f.Id == dto.LinkedFamilyId)) return NotFound("Linked family not found.");
            if (id == dto.LinkedFamilyId) return BadRequest("Cannot link a family to itself.");

            // Ensure we always have labels (use defaults if not provided)
            var forwardLabel = !string.IsNullOrWhiteSpace(dto.RelationLabel) ? dto.RelationLabel.Trim() : "Related family";
            var reverseLabel = !string.IsNullOrWhiteSpace(dto.ReverseLabel) ? dto.ReverseLabel.Trim() : "Related family";

            // Forward link
            if (!await _db.FamilyLinks.AnyAsync(l => l.FamilyId == id && l.LinkedFamilyId == dto.LinkedFamilyId))
            {
                _db.FamilyLinks.Add(new FamilyLink
                {
                    Id             = Guid.NewGuid(),
                    FamilyId       = id,
                    LinkedFamilyId = dto.LinkedFamilyId,
                    RelationLabel  = forwardLabel
                });
            }

            // Reverse link (always create if ReverseLabel is provided or we use default)
            if (!await _db.FamilyLinks.AnyAsync(l => l.FamilyId == dto.LinkedFamilyId && l.LinkedFamilyId == id))
            {
                _db.FamilyLinks.Add(new FamilyLink
                {
                    Id             = Guid.NewGuid(),
                    FamilyId       = dto.LinkedFamilyId,
                    LinkedFamilyId = id,
                    RelationLabel  = reverseLabel
                });
            }

            await _db.SaveChangesAsync();

            var linked = await _db.Families.FindAsync(dto.LinkedFamilyId);
            var fwd = await _db.FamilyLinks.FirstOrDefaultAsync(l => l.FamilyId == id && l.LinkedFamilyId == dto.LinkedFamilyId);
            return Ok(new { fwd!.Id, fwd.LinkedFamilyId, LinkedFamilyName = linked!.FamilyName, fwd.RelationLabel, Direction = "outgoing" });
        }

        /// <summary>
        /// POST /api/families/from-member/{memberId}
        /// Creates a new family named after the member, adds them as Head, and returns the new family.
        /// Optionally links it back to an origin family.
        /// </summary>
        [HttpPost("from-member/{memberId}")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,DataEntry")]
        public async Task<IActionResult> CreateFromMember(Guid memberId, [FromBody] CreateFromMemberDto dto)
        {
            var member = await _db.FamilyMembers.Include(m => m.Family).FirstOrDefaultAsync(m => m.Id == memberId);
            if (member == null) return NotFound("Member not found.");

            Guid targetFamilyId;
            string targetFamilyName;
            bool alreadyExisted = false;

            // ── Deduplication: check if a family already has this person as Head (by NationalId) ──
            FamilyMember? existingHead = null;
            if (!string.IsNullOrWhiteSpace(member.NationalId))
            {
                existingHead = await _db.FamilyMembers
                    .Where(m => m.NationalId == member.NationalId
                             && m.Relation == "Head"  // Only Head, not Father
                             && m.FamilyId != member.FamilyId)
                    .FirstOrDefaultAsync();
            }

            if (existingHead != null)
            {
                // Reuse the existing family — just add the links
                targetFamilyId   = existingHead.FamilyId!.Value;
                targetFamilyName = (await _db.Families.FindAsync(targetFamilyId))!.FamilyName;
                alreadyExisted   = true;
            }
            else
            {
                // Create a fresh family for this person
                var newFamily = new Family
                {
                    Id         = Guid.NewGuid(),
                    FamilyName = $"{member.FullName}'s Family",
                    Status     = member.Family?.Status
                };
                _db.Families.Add(newFamily);

                _db.FamilyMembers.Add(new FamilyMember
                {
                    Id          = Guid.NewGuid(),
                    FamilyId    = newFamily.Id,
                    FullName    = member.FullName,
                    Gender      = member.Gender,
                    DateOfBirth = member.DateOfBirth,
                    Relation    = "Head",
                    Mobile      = member.Mobile,
                    Notes       = member.Notes,
                    NationalId  = member.NationalId,
                    IsChild     = false
                });

                targetFamilyId   = newFamily.Id;
                targetFamilyName = newFamily.FamilyName;

                await _audit.LogAsync(new AuditLog { Action = "CreateFamilyFromMember", PerformedBy = User.Identity?.Name ?? "system", Entity = "Family", EntityId = newFamily.Id.ToString(), Details = newFamily.FamilyName });
            }

            // ── Create bidirectional links with origin family ──
            if (dto.OriginFamilyId.HasValue)
            {
                // Get the Head member's gender from the origin family to determine the label
                var originHead = await _db.FamilyMembers
                    .Where(m => m.FamilyId == dto.OriginFamilyId.Value && m.Relation == "Head")
                    .FirstOrDefaultAsync();
                
                if (originHead != null && !alreadyExisted)
                {
                    // Add the origin family's head as a son/daughter in the father's family
                    var childRelation = originHead.Gender?.ToLower() == "female" ? "Daughter" : "Son";
                    _db.FamilyMembers.Add(new FamilyMember
                    {
                        Id          = Guid.NewGuid(),
                        FamilyId    = targetFamilyId,
                        FullName    = originHead.FullName,
                        Gender      = originHead.Gender,
                        DateOfBirth = originHead.DateOfBirth,
                        Relation    = childRelation,
                        Mobile      = originHead.Mobile,
                        NationalId  = originHead.NationalId,
                        IsChild     = false
                    });
                }
                
                var originGender = originHead?.Gender?.ToLower();
                var originLabelFromFather = originGender == "female" ? "Daughter's family" : "Son's family";
                var newFamilyLabelToUse = !string.IsNullOrWhiteSpace(dto.NewFamilyLabel) ? dto.NewFamilyLabel.Trim() : "Father's family";

                // father's family → origin (child's) family
                if (!await _db.FamilyLinks.AnyAsync(l => l.FamilyId == targetFamilyId && l.LinkedFamilyId == dto.OriginFamilyId.Value))
                    _db.FamilyLinks.Add(new FamilyLink
                    {
                        Id             = Guid.NewGuid(),
                        FamilyId       = targetFamilyId,
                        LinkedFamilyId = dto.OriginFamilyId.Value,
                        RelationLabel  = originLabelFromFather
                    });

                // origin (child's) family → father's family
                if (!await _db.FamilyLinks.AnyAsync(l => l.FamilyId == dto.OriginFamilyId.Value && l.LinkedFamilyId == targetFamilyId))
                    _db.FamilyLinks.Add(new FamilyLink
                    {
                        Id             = Guid.NewGuid(),
                        FamilyId       = dto.OriginFamilyId.Value,
                        LinkedFamilyId = targetFamilyId,
                        RelationLabel  = newFamilyLabelToUse
                    });
            }

            // ── ALSO link the family where the member currently lives (matched family) to father's family ──
            // (skipped entirely if the member is standalone — not yet placed in any family)
            if (member.FamilyId.HasValue && member.FamilyId != dto.OriginFamilyId && member.FamilyId != targetFamilyId)
            {
                var memberFamilyId = member.FamilyId.Value;
                // Get the Head member's gender from the matched family
                var matchedHead = await _db.FamilyMembers
                    .Where(m => m.FamilyId == memberFamilyId && m.Relation == "Head")
                    .FirstOrDefaultAsync();
                
                if (matchedHead != null && !alreadyExisted)
                {
                    // Add the matched family's head as a son/daughter in the father's family
                    var childRelation = matchedHead.Gender?.ToLower() == "female" ? "Daughter" : "Son";
                    _db.FamilyMembers.Add(new FamilyMember
                    {
                        Id          = Guid.NewGuid(),
                        FamilyId    = targetFamilyId,
                        FullName    = matchedHead.FullName,
                        Gender      = matchedHead.Gender,
                        DateOfBirth = matchedHead.DateOfBirth,
                        Relation    = childRelation,
                        Mobile      = matchedHead.Mobile,
                        NationalId  = matchedHead.NationalId,
                        IsChild     = false
                    });
                }
                
                var matchedGender = matchedHead?.Gender?.ToLower();
                var matchedLabelFromFather = matchedGender == "female" ? "Daughter's family" : "Son's family";

                // father's family → matched family
                if (!await _db.FamilyLinks.AnyAsync(l => l.FamilyId == targetFamilyId && l.LinkedFamilyId == memberFamilyId))
                    _db.FamilyLinks.Add(new FamilyLink
                    {
                        Id             = Guid.NewGuid(),
                        FamilyId       = targetFamilyId,
                        LinkedFamilyId = memberFamilyId,
                        RelationLabel  = matchedLabelFromFather
                    });

                // matched family → father's family
                if (!await _db.FamilyLinks.AnyAsync(l => l.FamilyId == memberFamilyId && l.LinkedFamilyId == targetFamilyId))
                    _db.FamilyLinks.Add(new FamilyLink
                    {
                        Id             = Guid.NewGuid(),
                        FamilyId       = memberFamilyId,
                        LinkedFamilyId = targetFamilyId,
                        RelationLabel  = "Father's family"
                    });
            }

            await _db.SaveChangesAsync();

            return Ok(new { Id = targetFamilyId, FamilyName = targetFamilyName, AlreadyExisted = alreadyExisted });
        }

        /// <summary>PATCH /api/families/{id}/links/{linkId} — rename the relation label</summary>
        [HttpPatch("{id}/links/{linkId}")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,DataEntry")]
        public async Task<IActionResult> UpdateLink(Guid id, Guid linkId, [FromBody] FamilyLinkDto dto)
        {
            var link = await _db.FamilyLinks.FirstOrDefaultAsync(l => l.Id == linkId && l.FamilyId == id);
            if (link == null) return NotFound();
            link.RelationLabel = dto.RelationLabel?.Trim();
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>DELETE /api/families/{id}/links/{linkId}</summary>
        [HttpDelete("{id}/links/{linkId}")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,DataEntry")]
        public async Task<IActionResult> RemoveLink(Guid id, Guid linkId)
        {
            var link = await _db.FamilyLinks.FirstOrDefaultAsync(l => l.Id == linkId &&
                       (l.FamilyId == id || l.LinkedFamilyId == id));
            if (link == null) return NotFound();
            _db.FamilyLinks.Remove(link);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }

    public class FamilyLinkDto
    {
        public Guid LinkedFamilyId { get; set; }
        public string? RelationLabel { get; set; }
        /// <summary>If set, also creates the reverse link from LinkedFamily → this family</summary>
        public string? ReverseLabel { get; set; }
    }

    public class CreateFromMemberDto
    {
        /// <summary>The family from which we're spinning off this new family</summary>
        public Guid? OriginFamilyId { get; set; }
        /// <summary>Label on the new family's link → origin family</summary>
        public string? OriginLabel { get; set; }
        /// <summary>Label on the origin family's link → new family</summary>
        public string? NewFamilyLabel { get; set; }
    }
}
