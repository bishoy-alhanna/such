using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.DTOs;
using ShepherdCare.Api.Models;
using ShepherdCare.Api.Services;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MembersController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IAuditService _audit;
        private readonly INotificationService _notify;

        public MembersController(AppDbContext db, IAuditService audit, INotificationService notify)
        {
            _db = db;
            _audit = audit;
            _notify = notify;
        }

        // GET /api/members?q=&filter=withFamily|withoutFamily&gender=Male|Female&page=1&pageSize=20
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? q,
            [FromQuery] string? filter,
            [FromQuery] string? gender,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var callerRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";
            if (callerRole == "Member") return Forbid();

            var query = _db.FamilyMembers.Include(m => m.Family).AsQueryable();

            if (callerRole == "Servant" || callerRole == "DataEntry")
            {
                var userId = Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                             ?? User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
                var classIds = await _db.Set<Servant>()
                    .Where(s => s.UserId == userId).Select(s => s.ClassId).ToListAsync();
                var allowedIds = await _db.Set<ClassEnrollment>()
                    .Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).Distinct().ToListAsync();
                query = query.Where(m => allowedIds.Contains(m.Id));
            }

            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(m => m.FullName.Contains(q) ||
                    (m.NationalId != null && m.NationalId.Contains(q)) ||
                    (m.Mobile != null && m.Mobile.Contains(q)));

            if (filter == "withFamily")
                query = query.Where(m => m.FamilyId != null);
            else if (filter == "withoutFamily")
                query = query.Where(m => m.FamilyId == null);

            if (!string.IsNullOrWhiteSpace(gender))
                query = query.Where(m => m.Gender == gender);

            var total = await query.CountAsync();
            var items = await query
                .OrderBy(m => m.FullName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(m => new {
                    m.Id, m.FullName, m.FamilyId,
                    FamilyName = m.Family != null ? m.Family.FamilyName : (string?)null,
                    m.Gender, m.DateOfBirth, m.Relation, m.Mobile, m.NationalId,
                    m.Status, m.IsChild, m.PhotoUrl, m.IsServant
                })
                .ToListAsync();

            return Ok(new { items, total, totalPages = (int)Math.Ceiling((double)total / pageSize) });
        }

        [HttpGet("by-family/{familyId}")]
        public async Task<IActionResult> GetByFamily(Guid familyId)
        {
            var members = await _db.FamilyMembers.Where(m => m.FamilyId == familyId).ToListAsync();
            return Ok(members);
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] int pageSize = 20)
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var roleName = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? string.Empty;

            var query = _db.FamilyMembers.Include(m => m.Family).AsQueryable();

            // Servants and DataEntry can only search members in their assigned classes
            if ((roleName == "Servant" || roleName == "DataEntry") && Guid.TryParse(userIdClaim, out var userId))
            {
                var classIds = await _db.Set<Models.Servant>()
                    .Where(s => s.UserId == userId)
                    .Select(s => s.ClassId)
                    .ToListAsync();

                var allowedMemberIds = await _db.Set<Models.ClassEnrollment>()
                    .Where(e => classIds.Contains(e.ClassId))
                    .Select(e => e.MemberId)
                    .Distinct()
                    .ToListAsync();

                query = query.Where(m => allowedMemberIds.Contains(m.Id));
            }

            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(m => m.FullName.Contains(q));

            // Fetch extra rows to allow deduplication by NationalId
            var raw = await query.OrderBy(m => m.FullName).Take(pageSize * 4)
                .Select(m => new { m.Id, m.FullName, m.NationalId, m.FamilyId, FamilyName = m.Family != null ? m.Family.FamilyName : null })
                .ToListAsync();

            // Keep one record per person: deduplicate by NationalId, preserve order
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var items = new List<object>();
            foreach (var m in raw)
            {
                if (!string.IsNullOrWhiteSpace(m.NationalId))
                {
                    if (!seen.Add(m.NationalId)) continue;
                }
                items.Add(new { m.Id, m.FullName, m.FamilyId, m.FamilyName });
                if (items.Count >= pageSize) break;
            }
            return Ok(new { items });
        }

        /// <summary>
        /// Resolves a family for a member being created/linked without an explicit FamilyId:
        /// finds the family of an existing member with the given father's National ID, or
        /// creates a brand-new family (named after the member) if no such father is found.
        /// Mirrors the family-resolution logic used at member self-signup.
        /// </summary>
        private async Task<Guid> ResolveOrCreateFamilyByFatherNationalIdAsync(string fatherNationalId, string fallbackFamilyName)
        {
            var father = await _db.FamilyMembers.FirstOrDefaultAsync(m => m.NationalId == fatherNationalId);
            if (father?.FamilyId != null) return father.FamilyId.Value;

            var newFamily = new Family { FamilyName = fallbackFamilyName };
            _db.Families.Add(newFamily);
            await _db.SaveChangesAsync();
            return newFamily.Id;
        }

        [HttpPost]
        public async Task<IActionResult> Create(MemberCreateDto dto)
        {
            if (!string.IsNullOrEmpty(dto.NationalId) &&
                (dto.NationalId.Length != 14 || !dto.NationalId.All(char.IsDigit)))
                return BadRequest("National ID must be exactly 14 digits.");

            if (!string.IsNullOrWhiteSpace(dto.FatherNationalId) &&
                (dto.FatherNationalId.Trim().Length != 14 || !dto.FatherNationalId.Trim().All(char.IsDigit)))
                return BadRequest("Father's National ID must be exactly 14 digits.");

            var familyId = dto.FamilyId;
            if (familyId == null && !string.IsNullOrWhiteSpace(dto.FatherNationalId))
                familyId = await ResolveOrCreateFamilyByFatherNationalIdAsync(dto.FatherNationalId.Trim(), dto.FullName);

            var m = new FamilyMember
            {
                FamilyId          = familyId,
                FullName          = dto.FullName,
                Gender            = dto.Gender,
                DateOfBirth       = dto.DateOfBirth,
                Relation          = dto.Relation,
                Mobile            = dto.Mobile,
                IsChild           = dto.IsChild,
                Notes             = dto.Notes,
                NationalId        = string.IsNullOrWhiteSpace(dto.NationalId) ? null : dto.NationalId.Trim(),
                OccupationStatus  = dto.OccupationStatus,
                StudyYear         = dto.StudyYear,
                College           = dto.College,
                JobTitle          = dto.JobTitle,
                JobDetails        = dto.JobDetails,
                Qualification     = dto.Qualification,
                Church            = dto.Church,
                MeetingAttended   = dto.MeetingAttended,
                ConfessionFather  = dto.ConfessionFather,
                LastConfessionDate = dto.LastConfessionDate,
                LastCommunionDate = dto.LastCommunionDate,
                LastCallDate      = dto.LastCallDate,
                IsServant         = dto.IsServant,
                ServiceType       = dto.ServiceType,
                BaptismName       = dto.BaptismName?.Trim(),
                NameDayMonth      = dto.NameDayMonth,
                NameDayDay        = dto.NameDayDay,
                Status            = dto.Status,
                PhotoUrl          = dto.PhotoUrl,
            };
            _db.FamilyMembers.Add(m);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "CreateMember", PerformedBy = User.Identity?.Name ?? "system", Entity = "FamilyMember", EntityId = m.Id.ToString(), Details = m.FullName });

            object? servantUser = null;
            if (dto.IsServant)
                servantUser = await AutoCreateServantUserAsync(m.Id, m.FullName, m.Mobile);

            return CreatedAtAction(nameof(GetById), new { id = m.Id }, new
            {
                m.Id, m.FamilyId, m.FullName, m.Gender, m.DateOfBirth, m.Mobile, m.Relation,
                m.IsChild, m.NationalId, m.OccupationStatus, m.StudyYear, m.College,
                m.JobTitle, m.JobDetails, m.Qualification, m.Church, m.MeetingAttended,
                m.ConfessionFather, m.LastConfessionDate, m.LastCommunionDate, m.LastCallDate,
                m.IsServant, m.ServiceType, m.BaptismName, m.NameDayMonth, m.NameDayDay,
                m.Status, m.PhotoUrl, m.CreatedAt,
                servantUser
            });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var m = await _db.FamilyMembers.FindAsync(id);
            if (m == null) return NotFound();
            return Ok(m);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, MemberCreateDto dto)
        {
            var callerRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";
            if (callerRole == "Member") return Forbid();

            var m = await _db.FamilyMembers.FindAsync(id);
            if (m == null) return NotFound();

            if (!string.IsNullOrEmpty(dto.NationalId) &&
                (dto.NationalId.Length != 14 || !dto.NationalId.All(char.IsDigit)))
                return BadRequest("National ID must be exactly 14 digits.");

            if (!string.IsNullOrWhiteSpace(dto.FatherNationalId) &&
                (dto.FatherNationalId.Trim().Length != 14 || !dto.FatherNationalId.Trim().All(char.IsDigit)))
                return BadRequest("Father's National ID must be exactly 14 digits.");

            // Standalone member (created without a family) being linked to one now.
            if (m.FamilyId == null && !string.IsNullOrWhiteSpace(dto.FatherNationalId))
                m.FamilyId = await ResolveOrCreateFamilyByFatherNationalIdAsync(dto.FatherNationalId.Trim(), m.FullName);

            m.FullName          = dto.FullName;
            m.Gender            = dto.Gender;
            m.DateOfBirth       = dto.DateOfBirth;
            m.Relation          = dto.Relation;
            m.Mobile            = dto.Mobile;
            m.IsChild           = dto.IsChild;
            m.Notes             = dto.Notes;
            m.NationalId        = string.IsNullOrWhiteSpace(dto.NationalId) ? null : dto.NationalId.Trim();
            m.OccupationStatus  = dto.OccupationStatus;
            m.StudyYear         = dto.StudyYear;
            m.College           = dto.College;
            m.JobTitle          = dto.JobTitle;
            m.JobDetails        = dto.JobDetails;
            m.Qualification     = dto.Qualification;
            m.Church            = dto.Church;
            m.MeetingAttended   = dto.MeetingAttended;
            m.ConfessionFather  = dto.ConfessionFather;
            m.LastConfessionDate = dto.LastConfessionDate;
            m.LastCommunionDate = dto.LastCommunionDate;
            m.LastCallDate      = dto.LastCallDate;
            bool becameServant = !m.IsServant && dto.IsServant;
            m.IsServant         = dto.IsServant;
            m.ServiceType       = dto.ServiceType;
            m.BaptismName       = dto.BaptismName?.Trim();
            m.NameDayMonth      = dto.NameDayMonth;
            m.NameDayDay        = dto.NameDayDay;
            m.Status            = dto.Status;
            m.PhotoUrl          = dto.PhotoUrl;
            await _db.SaveChangesAsync();

            // Sync shared personal fields to all sibling records (same NationalId, different family)
            if (!string.IsNullOrWhiteSpace(m.NationalId))
            {
                var siblings = await _db.FamilyMembers
                    .Where(x => x.NationalId == m.NationalId && x.Id != m.Id)
                    .ToListAsync();
                foreach (var s in siblings)
                {
                    s.FullName          = m.FullName;
                    s.Gender            = m.Gender;
                    s.DateOfBirth       = m.DateOfBirth;
                    s.Mobile            = m.Mobile;
                    s.OccupationStatus  = m.OccupationStatus;
                    s.StudyYear         = m.StudyYear;
                    s.College           = m.College;
                    s.JobTitle          = m.JobTitle;
                    s.JobDetails        = m.JobDetails;
                    s.Qualification     = m.Qualification;
                    s.Church            = m.Church;
                    s.MeetingAttended   = m.MeetingAttended;
                    s.ConfessionFather  = m.ConfessionFather;
                    s.LastConfessionDate = m.LastConfessionDate;
                    s.LastCommunionDate  = m.LastCommunionDate;
                    s.Notes             = m.Notes;
                    s.Status            = m.Status;
                }
                if (siblings.Any()) await _db.SaveChangesAsync();
            }

            await _audit.LogAsync(new AuditLog { Action = "UpdateMember", PerformedBy = User.Identity?.Name ?? "system", Entity = "FamilyMember", EntityId = m.Id.ToString(), Details = m.FullName });

            if (becameServant)
            {
                var servantUser = await AutoCreateServantUserAsync(m.Id, m.FullName, m.Mobile);
                if (servantUser != null)
                    return Ok(new { servantUser });
            }

            return NoContent();
        }

        /// <summary>POST /api/members/{id}/photo — upload a profile photo</summary>
        [HttpPost("{id}/photo")]
        public async Task<IActionResult> UploadPhoto(Guid id, IFormFile file,
            [FromServices] IWebHostEnvironment env)
        {
            var m = await _db.FamilyMembers.FindAsync(id);
            if (m == null) return NotFound();
            if (file == null || file.Length == 0) return BadRequest("No file provided.");

            var allowed = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
            if (!allowed.Contains(file.ContentType.ToLower()))
                return BadRequest("Only JPEG, PNG, WebP, or GIF images are allowed.");

            if (file.Length > 5 * 1024 * 1024)
                return BadRequest("File must be under 5 MB.");

            var uploadsDir = Path.Combine(env.ContentRootPath, "wwwroot", "uploads");
            Directory.CreateDirectory(uploadsDir);

            // Delete old photo if it was previously uploaded
            if (!string.IsNullOrEmpty(m.PhotoUrl) && m.PhotoUrl.StartsWith("/uploads/"))
            {
                var oldPath = Path.Combine(env.ContentRootPath, "wwwroot", m.PhotoUrl.TrimStart('/'));
                if (System.IO.File.Exists(oldPath)) System.IO.File.Delete(oldPath);
            }

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var fileName = $"{id}{ext}";
            var filePath = Path.Combine(uploadsDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
                await file.CopyToAsync(stream);

            m.PhotoUrl = $"/uploads/{fileName}";
            await _db.SaveChangesAsync();

            return Ok(new { photoUrl = m.PhotoUrl });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id, [FromQuery] string scope = "family")
        {
            var m = await _db.FamilyMembers.FindAsync(id);
            if (m == null) return NotFound();

            if (scope == "all")
            {
                // Remove every FamilyMember record sharing this National ID
                var siblings = string.IsNullOrWhiteSpace(m.NationalId)
                    ? new List<FamilyMember> { m }
                    : await _db.FamilyMembers.Where(x => x.NationalId == m.NationalId).ToListAsync();

                var siblingIds = siblings.Select(s => s.Id).ToHashSet();

                // Delete the one User linked to any of these records
                var linkedUser = await _db.Users
                    .FirstOrDefaultAsync(u => u.FamilyMemberId.HasValue && siblingIds.Contains(u.FamilyMemberId!.Value));
                if (linkedUser != null) _db.Users.Remove(linkedUser);

                _db.FamilyMembers.RemoveRange(siblings);
                await _db.SaveChangesAsync();

                await _audit.LogAsync(new AuditLog { Action = "DeleteMemberAll", PerformedBy = User.Identity?.Name ?? "system", Entity = "FamilyMember", EntityId = id.ToString(), Details = $"{m.FullName} (all families + user)" });
            }
            else
            {
                _db.FamilyMembers.Remove(m);
                await _db.SaveChangesAsync();

                await _audit.LogAsync(new AuditLog { Action = "DeleteMember", PerformedBy = User.Identity?.Name ?? "system", Entity = "FamilyMember", EntityId = id.ToString(), Details = m.FullName });
            }

            return NoContent();
        }

        /// <summary>
        /// GET /api/members/suggest-links/{familyId}
        /// Returns other families that share a National ID match with any member of this family.
        /// The match logic:
        ///   • A member of THIS family has a NationalId that belongs to a Head/Father/Spouse in ANOTHER family, OR
        ///   • A Head/Father/Spouse in THIS family has a NationalId that appears on any member of ANOTHER family.
        /// Excludes families already linked.
        /// </summary>
        // ── Servant assignment endpoints ──────────────────────────────────────

        /// <summary>GET /api/members/{id}/servant-assignments — classes this servant is assigned to</summary>
        [HttpGet("{id}/servant-assignments")]
        public async Task<IActionResult> GetServantAssignments(Guid id)
        {
            var linkedUser = await _db.Set<User>().FirstOrDefaultAsync(u => u.FamilyMemberId == id);
            if (linkedUser == null)
                return Ok(new { username = (string?)null, assignments = new object[0] });

            var assignments = await _db.Servants
                .Where(s => s.UserId == linkedUser.Id)
                .Include(s => s.Class)
                .Select(s => new { s.Id, s.ClassId, ClassName = s.Class != null ? s.Class.ClassName : null })
                .ToListAsync();

            return Ok(new { username = linkedUser.Username, userId = linkedUser.Id, assignments });
        }

        /// <summary>POST /api/members/{id}/servant-assignments — assign to a class</summary>
        [HttpPost("{id}/servant-assignments")]
        public async Task<IActionResult> AddServantAssignment(Guid id, [FromBody] ServantAssignmentDto dto)
        {
            var linkedUser = await _db.Set<User>().FirstOrDefaultAsync(u => u.FamilyMemberId == id);
            if (linkedUser == null)
                return BadRequest("لا يوجد حساب مستخدم مرتبط بهذا الفرد. يجب تفعيل وضع الخادم أولاً.");

            var exists = await _db.Servants.AnyAsync(s => s.UserId == linkedUser.Id && s.ClassId == dto.ClassId);
            if (exists) return Conflict("الفرد مسجل بالفعل في هذا الفصل.");

            var servant = new Servant { Id = Guid.NewGuid(), UserId = linkedUser.Id, ClassId = dto.ClassId };
            _db.Servants.Add(servant);
            await _db.SaveChangesAsync();

            var cls = await _db.Classes.FindAsync(dto.ClassId);
            return Ok(new { servant.Id, servant.ClassId, ClassName = cls?.ClassName });
        }

        /// <summary>DELETE /api/members/{id}/servant-assignments/{assignmentId}</summary>
        [HttpDelete("{id}/servant-assignments/{assignmentId}")]
        public async Task<IActionResult> RemoveServantAssignment(Guid id, Guid assignmentId)
        {
            var linkedUser = await _db.Set<User>().FirstOrDefaultAsync(u => u.FamilyMemberId == id);
            if (linkedUser == null) return NotFound();

            var servant = await _db.Servants.FirstOrDefaultAsync(s => s.Id == assignmentId && s.UserId == linkedUser.Id);
            if (servant == null) return NotFound();

            _db.Servants.Remove(servant);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>POST /api/members/{id}/link-user — link a user account to this member by username</summary>
        [HttpPost("{id}/link-user")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest")]
        public async Task<IActionResult> LinkUser(Guid id, [FromBody] LinkUserDto dto)
        {
            var m = await _db.FamilyMembers.FindAsync(id);
            if (m == null) return NotFound();

            var targetUser = await _db.Users.FirstOrDefaultAsync(u => u.Username == dto.Username);
            if (targetUser == null) return NotFound(new { message = "المستخدم غير موجود." });

            targetUser.FamilyMemberId = id;
            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "LinkUser", PerformedBy = User.Identity?.Name ?? "system", Entity = "User", EntityId = targetUser.Id.ToString(), Details = $"{targetUser.Username} → {m.FullName}" });
            return Ok(new { targetUser.Id, targetUser.Username });
        }

        /// <summary>DELETE /api/members/{id}/link-user — remove user link from this member</summary>
        [HttpDelete("{id}/link-user")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest")]
        public async Task<IActionResult> UnlinkUser(Guid id)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.FamilyMemberId == id);
            if (user == null) return NotFound();

            user.FamilyMemberId = null;
            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "UnlinkUser", PerformedBy = User.Identity?.Name ?? "system", Entity = "User", EntityId = user.Id.ToString(), Details = user.Username });
            return NoContent();
        }

        [HttpGet("suggest-links/{familyId}")]
        public async Task<IActionResult> SuggestLinks(Guid familyId)
        {
            var thisNids = await _db.FamilyMembers
                .Where(m => m.FamilyId == familyId && m.NationalId != null)
                .Select(m => new { m.Id, m.NationalId, m.FullName, m.Relation, m.Gender })
                .ToListAsync();

            if (!thisNids.Any()) return Ok(new object[0]);

            var nidSet = thisNids.Select(x => x.NationalId!).ToList();

            var alreadyLinked = await _db.FamilyLinks
                .Where(l => l.FamilyId == familyId || l.LinkedFamilyId == familyId)
                .Select(l => l.FamilyId == familyId ? l.LinkedFamilyId : l.FamilyId)
                .ToListAsync();

            var matches = await _db.FamilyMembers
                .Include(m => m.Family)
                .Where(m => m.FamilyId != null
                         && m.FamilyId != familyId
                         && m.NationalId != null
                         && nidSet.Contains(m.NationalId!)
                         && !alreadyLinked.Contains(m.FamilyId!.Value))
                .Select(m => new
                {
                    MatchedMemberId       = m.Id,
                    FamilyId              = m.FamilyId,
                    FamilyName            = m.Family!.FamilyName,
                    MatchedMemberName     = m.FullName,
                    MatchedMemberRelation = m.Relation,
                    MatchedMemberGender   = m.Gender,
                    NationalId            = m.NationalId
                })
                .ToListAsync();

            var result = matches.Select(match =>
            {
                var local = thisNids.FirstOrDefault(x => x.NationalId == match.NationalId);
                return new
                {
                    match.MatchedMemberId,
                    match.FamilyId,
                    match.FamilyName,
                    match.MatchedMemberName,
                    match.MatchedMemberRelation,
                    match.MatchedMemberGender,
                    LocalMemberId       = local?.Id,
                    LocalMemberName     = local?.FullName,
                    LocalMemberRelation = local?.Relation,
                    LocalMemberGender   = local?.Gender,
                    match.NationalId
                };
            }).DistinctBy(x => x.FamilyId).ToList();

            return Ok(result);
        }

        /// <summary>GET /api/members/profile — returns the current user's linked FamilyMember record.</summary>
        [HttpGet("profile")]
        public async Task<IActionResult> GetMyProfile()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();

            var user = await _db.Users.FindAsync(Guid.Parse(userId));
            if (user?.FamilyMemberId == null) return NotFound(new { message = "No member profile linked to this account." });

            var m = await _db.FamilyMembers.Include(x => x.Family).FirstOrDefaultAsync(x => x.Id == user.FamilyMemberId);
            if (m == null) return NotFound();

            return Ok(new {
                m.Id, m.FamilyId, m.FullName, m.Gender, m.DateOfBirth, m.Mobile, m.NationalId,
                m.Relation, m.IsChild, m.OccupationStatus, m.StudyYear, m.College, m.JobTitle,
                m.JobDetails, m.Qualification, m.Church, m.MeetingAttended, m.ConfessionFather,
                m.LastConfessionDate, m.LastCommunionDate, m.Notes, m.PhotoUrl, m.Status,
                FamilyName = m.Family != null ? m.Family.FamilyName : null,
            });
        }

        /// <summary>PUT /api/members/profile — lets the current user update their own member record.</summary>
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateMyProfile([FromBody] ProfileUpdateDto dto)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();

            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";

            var user = await _db.Users.FindAsync(Guid.Parse(userId));
            if (user?.FamilyMemberId == null) return NotFound(new { message = "No member profile linked to this account." });

            // Members must go through approval flow
            if (role == "Member")
            {
                return await RequestProfileUpdate(dto);
            }

            var m = await _db.FamilyMembers.FindAsync(user.FamilyMemberId);
            if (m == null) return NotFound();

            m.Mobile            = dto.Mobile ?? m.Mobile;
            m.Gender            = dto.Gender ?? m.Gender;
            m.DateOfBirth       = dto.DateOfBirth ?? m.DateOfBirth;
            m.OccupationStatus  = dto.OccupationStatus ?? m.OccupationStatus;
            m.StudyYear         = dto.StudyYear ?? m.StudyYear;
            m.College           = dto.College ?? m.College;
            m.JobTitle          = dto.JobTitle ?? m.JobTitle;
            m.JobDetails        = dto.JobDetails ?? m.JobDetails;
            m.Qualification     = dto.Qualification ?? m.Qualification;
            m.Church            = dto.Church ?? m.Church;
            m.MeetingAttended   = dto.MeetingAttended ?? m.MeetingAttended;
            m.ConfessionFather  = dto.ConfessionFather ?? m.ConfessionFather;
            m.LastConfessionDate = dto.LastConfessionDate ?? m.LastConfessionDate;
            m.LastCommunionDate  = dto.LastCommunionDate ?? m.LastCommunionDate;
            m.Notes             = dto.Notes ?? m.Notes;
            if (dto.BaptismName  != null) m.BaptismName  = dto.BaptismName.Trim();
            if (dto.NameDayMonth != null) m.NameDayMonth = dto.NameDayMonth;
            if (dto.NameDayDay   != null) m.NameDayDay   = dto.NameDayDay;

            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "UpdateProfile", PerformedBy = User.Identity?.Name ?? "system", Entity = "FamilyMember", EntityId = m.Id.ToString(), Details = m.FullName });
            return NoContent();
        }

        /// <summary>POST /api/members/me/request-update — Member submits a profile update for approval</summary>
        [HttpPost("me/request-update")]
        public async Task<IActionResult> RequestProfileUpdate([FromBody] ProfileUpdateDto dto)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();

            var user = await _db.Users.FindAsync(Guid.Parse(userId));
            if (user?.FamilyMemberId == null) return NotFound(new { message = "No member profile linked to this account." });

            // Check for existing pending update
            var existingPending = await _db.PendingMemberUpdates
                .AnyAsync(p => p.MemberId == user.FamilyMemberId.Value && p.Status == "Pending");
            if (existingPending)
                return BadRequest(new { message = "لديك طلب تعديل معلق بالفعل. يرجى الانتظار حتى تتم مراجعته." });

            var changesJson = System.Text.Json.JsonSerializer.Serialize(dto);

            var pending = new PendingMemberUpdate
            {
                Id = Guid.NewGuid(),
                MemberId = user.FamilyMemberId.Value,
                ChangesJson = changesJson,
                Status = "Pending",
                SubmittedById = Guid.Parse(userId),
                SubmittedAt = DateTime.UtcNow
            };
            _db.PendingMemberUpdates.Add(pending);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "RequestProfileUpdate", PerformedBy = User.Identity?.Name ?? "system", Entity = "PendingMemberUpdate", EntityId = pending.Id.ToString(), Details = $"Member {user.FamilyMemberId} requested profile update" });

            var servantIds = await GetServantUserIdsForMemberAsync(user.FamilyMemberId.Value);
            if (servantIds.Count > 0)
                await _notify.NotifyManyAsync(servantIds,
                    "طلب تعديل بيانات جديد",
                    $"قدّم أحد الأعضاء طلب تعديل بياناته ويحتاج إلى مراجعة.",
                    "pending_update",
                    "/members/pending-updates");

            return Ok(new { pending.Id, pending.Status, pending.SubmittedAt });
        }

        /// <summary>GET /api/members/me/pending-update — Member checks their pending update status</summary>
        [HttpGet("me/pending-update")]
        public async Task<IActionResult> GetMyPendingUpdate()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();
            var user = await _db.Users.FindAsync(Guid.Parse(userId));
            if (user?.FamilyMemberId == null) return Ok(null);

            var pending = await _db.PendingMemberUpdates
                .Where(p => p.MemberId == user.FamilyMemberId.Value)
                .OrderByDescending(p => p.SubmittedAt)
                .Select(p => new { p.Id, p.Status, p.SubmittedAt, p.ReviewNote, p.ReviewedAt })
                .FirstOrDefaultAsync();
            return Ok(pending);
        }

        /// <summary>GET /api/members/pending-updates — Servant/Admin sees pending profile updates</summary>
        [HttpGet("pending-updates")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,Servant,DataEntry")]
        public async Task<IActionResult> GetPendingUpdates()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";

            IQueryable<PendingMemberUpdate> query = _db.PendingMemberUpdates.Where(p => p.Status == "Pending");

            if ((role == "Servant" || role == "DataEntry") && Guid.TryParse(userId, out var uid))
            {
                var classIds = await _db.Servants.Where(s => s.UserId == uid).Select(s => s.ClassId).ToListAsync();
                var memberIds = await _db.ClassEnrollments.Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).ToListAsync();
                query = query.Where(p => memberIds.Contains(p.MemberId));
            }

            var items = await query.OrderBy(p => p.SubmittedAt)
                .Select(p => new
                {
                    p.Id,
                    p.MemberId,
                    MemberName = p.Member != null ? p.Member.FullName : null,
                    p.ChangesJson,
                    p.Status,
                    p.SubmittedAt,
                    SubmittedByName = p.SubmittedBy != null ? p.SubmittedBy.DisplayName ?? p.SubmittedBy.Username : null
                }).ToListAsync();
            return Ok(items);
        }

        /// <summary>POST /api/members/pending-updates/{id}/approve</summary>
        [HttpPost("pending-updates/{id}/approve")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,Servant,DataEntry")]
        public async Task<IActionResult> ApprovePendingUpdate(Guid id, [FromBody] ReviewNoteDto dto)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";

            var pending = await _db.PendingMemberUpdates.FindAsync(id);
            if (pending == null) return NotFound();
            if (pending.Status != "Pending") return BadRequest("No longer pending.");

            if ((role == "Servant" || role == "DataEntry") && Guid.TryParse(userId, out var uid))
            {
                var classIds = await _db.Servants.Where(s => s.UserId == uid).Select(s => s.ClassId).ToListAsync();
                var memberIds = await _db.ClassEnrollments.Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).ToListAsync();
                if (!memberIds.Contains(pending.MemberId)) return Forbid();
            }

            var m = await _db.FamilyMembers.FindAsync(pending.MemberId);
            if (m == null) return NotFound("Member not found.");

            // Apply changes from JSON
            var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var changes = System.Text.Json.JsonSerializer.Deserialize<ProfileUpdateDto>(pending.ChangesJson, options);
            if (changes != null)
            {
                if (changes.Mobile != null) m.Mobile = changes.Mobile;
                if (changes.Gender != null) m.Gender = changes.Gender;
                if (changes.DateOfBirth.HasValue) m.DateOfBirth = changes.DateOfBirth;
                if (changes.OccupationStatus != null) m.OccupationStatus = changes.OccupationStatus;
                if (changes.StudyYear != null) m.StudyYear = changes.StudyYear;
                if (changes.College != null) m.College = changes.College;
                if (changes.JobTitle != null) m.JobTitle = changes.JobTitle;
                if (changes.JobDetails != null) m.JobDetails = changes.JobDetails;
                if (changes.Qualification != null) m.Qualification = changes.Qualification;
                if (changes.Church != null) m.Church = changes.Church;
                if (changes.MeetingAttended != null) m.MeetingAttended = changes.MeetingAttended;
                if (changes.ConfessionFather != null) m.ConfessionFather = changes.ConfessionFather;
                if (changes.LastConfessionDate.HasValue) m.LastConfessionDate = changes.LastConfessionDate;
                if (changes.LastCommunionDate.HasValue) m.LastCommunionDate = changes.LastCommunionDate;
                if (changes.Notes != null) m.Notes = changes.Notes;
            }

            pending.Status = "Approved";
            pending.ReviewedById = userId != null ? Guid.Parse(userId) : (Guid?)null;
            pending.ReviewedAt = DateTime.UtcNow;
            pending.ReviewNote = dto.Note;

            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "ApproveProfileUpdate", PerformedBy = User.Identity?.Name ?? "system", Entity = "PendingMemberUpdate", EntityId = id.ToString(), Details = m.FullName });

            var approvedMemberUserId = await GetMemberUserIdAsync(pending.MemberId);
            if (approvedMemberUserId.HasValue)
                await _notify.NotifyAsync(approvedMemberUserId.Value,
                    "تم قبول تعديل بياناتك ✓",
                    "تمت مراجعة طلب تعديل بياناتك والموافقة عليه.",
                    "update_approved",
                    "/profile");

            return Ok(new { pending.Id, pending.Status });
        }

        /// <summary>POST /api/members/pending-updates/{id}/reject</summary>
        [HttpPost("pending-updates/{id}/reject")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,Servant,DataEntry")]
        public async Task<IActionResult> RejectPendingUpdate(Guid id, [FromBody] ReviewNoteDto dto)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";

            var pending = await _db.PendingMemberUpdates.FindAsync(id);
            if (pending == null) return NotFound();
            if (pending.Status != "Pending") return BadRequest("No longer pending.");

            if ((role == "Servant" || role == "DataEntry") && Guid.TryParse(userId, out var uid))
            {
                var classIds = await _db.Servants.Where(s => s.UserId == uid).Select(s => s.ClassId).ToListAsync();
                var memberIds = await _db.ClassEnrollments.Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).ToListAsync();
                if (!memberIds.Contains(pending.MemberId)) return Forbid();
            }

            pending.Status = "Rejected";
            pending.ReviewedById = userId != null ? Guid.Parse(userId) : (Guid?)null;
            pending.ReviewedAt = DateTime.UtcNow;
            pending.ReviewNote = dto.Note;
            await _db.SaveChangesAsync();

            var rejectedMemberUserId = await GetMemberUserIdAsync(pending.MemberId);
            if (rejectedMemberUserId.HasValue)
                await _notify.NotifyAsync(rejectedMemberUserId.Value,
                    "طلب التعديل مرفوض",
                    "تم رفض طلب تعديل بياناتك." + (string.IsNullOrWhiteSpace(dto.Note) ? "" : $" — {dto.Note}"),
                    "update_rejected",
                    "/profile");

            return Ok(new { pending.Id, pending.Status });
        }

        // ── Private helpers ───────────────────────────────────────────────────

        private async Task<List<Guid>> GetServantUserIdsForMemberAsync(Guid memberId)
        {
            var member = await _db.FamilyMembers.FindAsync(memberId);
            var siblingIds = new List<Guid> { memberId };
            if (!string.IsNullOrWhiteSpace(member?.NationalId))
                siblingIds.AddRange(await _db.FamilyMembers
                    .Where(m => m.NationalId == member.NationalId && m.Id != memberId)
                    .Select(m => m.Id).ToListAsync());

            var classIds = await _db.ClassEnrollments
                .Where(e => siblingIds.Contains(e.MemberId))
                .Select(e => e.ClassId).Distinct().ToListAsync();

            return await _db.Servants
                .Where(s => classIds.Contains(s.ClassId))
                .Select(s => s.UserId).Distinct().ToListAsync();
        }

        private async Task<Guid?> GetMemberUserIdAsync(Guid memberId)
        {
            var member = await _db.FamilyMembers.FindAsync(memberId);
            var ids = new List<Guid> { memberId };
            if (!string.IsNullOrWhiteSpace(member?.NationalId))
                ids.AddRange(await _db.FamilyMembers
                    .Where(m => m.NationalId == member.NationalId && m.Id != memberId)
                    .Select(m => m.Id).ToListAsync());
            var user = await _db.Users.FirstOrDefaultAsync(u => u.FamilyMemberId.HasValue && ids.Contains(u.FamilyMemberId!.Value));
            return user?.Id;
        }

        private async Task<object?> AutoCreateServantUserAsync(Guid memberId, string fullName, string? mobile)
        {
            // Skip if a user is already linked to this member
            if (await _db.Set<User>().AnyAsync(u => u.FamilyMemberId == memberId))
                return null;

            var servantRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Servant");
            if (servantRole == null) return null;

            var defaultPassword = "Servant@123";
            var username = !string.IsNullOrWhiteSpace(mobile)
                ? mobile.Trim()
                : $"servant_{memberId.ToString("N")[..8]}";

            // Ensure username is unique
            var baseUsername = username;
            var suffix = 1;
            while (await _db.Set<User>().AnyAsync(u => u.Username == username))
                username = $"{baseUsername}_{suffix++}";

            var newUser = new User
            {
                Id             = Guid.NewGuid(),
                Username       = username,
                PasswordHash   = BCrypt.Net.BCrypt.HashPassword(defaultPassword),
                DisplayName    = fullName,
                RoleId         = servantRole.Id,
                IsActive       = true,
                FamilyMemberId = memberId,
            };
            _db.Set<User>().Add(newUser);
            await _db.SaveChangesAsync();

            return new { username, defaultPassword };
        }
    }

    public class ServantAssignmentDto
    {
        public Guid ClassId { get; set; }
    }

    public class ReviewNoteDto { public string? Note { get; set; } }
}
