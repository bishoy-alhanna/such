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
    [Route("api/scores")]
    [Authorize]
    public class ScoresController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IAuditService _audit;
        private readonly INotificationService _notify;

        private static readonly string[] FullAccessRoles = ["SuperAdmin", "ServiceLeader", "Priest"];
        private static readonly string[] ReviewerRoles = ["SuperAdmin", "ServiceLeader", "Priest", "Servant", "DataEntry"];

        public ScoresController(AppDbContext db, IAuditService audit, INotificationService notify)
        {
            _db = db;
            _audit = audit;
            _notify = notify;
        }

        /// <summary>Returns User IDs of servants assigned to any of the given class IDs.</summary>
        private async Task<List<Guid>> GetServantUserIdsForClassesAsync(IEnumerable<Guid> classIds)
        {
            return await _db.Servants
                .Where(s => classIds.Contains(s.ClassId))
                .Select(s => s.UserId)
                .Distinct()
                .ToListAsync();
        }

        /// <summary>Returns the User linked to a FamilyMember (checks all NationalId siblings).</summary>
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

        /// <summary>
        /// Given a member ID, find the sibling record (same NationalId) that is enrolled in a class.
        /// Returns the original ID if no better match is found.
        /// </summary>
        private async Task<Guid> ResolveEnrolledMemberIdAsync(Guid memberId)
        {
            var member = await _db.FamilyMembers.FindAsync(memberId);
            if (string.IsNullOrWhiteSpace(member?.NationalId)) return memberId;

            var siblingIds = await _db.FamilyMembers
                .Where(m => m.NationalId == member.NationalId)
                .Select(m => m.Id)
                .ToListAsync();

            var enrolledId = await _db.ClassEnrollments
                .Where(e => siblingIds.Contains(e.MemberId))
                .Select(e => e.MemberId)
                .FirstOrDefaultAsync();

            return enrolledId != Guid.Empty ? enrolledId : memberId;
        }

        private (bool ok, Guid userId, string role) GetCaller()
        {
            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var role = User.FindFirstValue(ClaimTypes.Role) ?? "";
            if (!Guid.TryParse(uid, out var id)) return (false, Guid.Empty, role);
            return (true, id, role);
        }

        private async Task<(bool hasAccess, HashSet<Guid>? allowedMemberIds)> ResolveAccessAsync()
        {
            var (ok, userId, role) = GetCaller();
            if (!ok) return (false, null);

            if (FullAccessRoles.Contains(role)) return (true, null);

            if (role == "Servant" || role == "DataEntry")
            {
                var classIds = await _db.Servants.Where(s => s.UserId == userId).Select(s => s.ClassId).ToListAsync();
                var memberIds = await _db.ClassEnrollments.Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).ToListAsync();
                return (true, memberIds.ToHashSet());
            }

            return (false, null);
        }

        // ─── List ─────────────────────────────────────────────────────────────

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] Guid? memberId, [FromQuery] Guid? categoryId, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
        {
            var (hasAccess, allowedIds) = await ResolveAccessAsync();
            if (!hasAccess) return Forbid();

            var query = _db.ScoreEntries.AsQueryable();
            if (allowedIds != null) query = query.Where(e => allowedIds.Contains(e.MemberId));
            if (memberId.HasValue) query = query.Where(e => e.MemberId == memberId.Value);
            if (categoryId.HasValue) query = query.Where(e => e.CategoryId == categoryId.Value);

            var total = await query.CountAsync();
            var items = await query.OrderByDescending(e => e.Date).Skip((page - 1) * pageSize).Take(pageSize)
                .Select(e => new
                {
                    e.Id, e.MemberId, MemberName = e.Member != null ? e.Member.FullName : null,
                    e.CategoryId, CategoryName = e.Category != null ? e.Category.Name : null,
                    e.ScoreValue, e.Date, e.Description, e.CreatedAt,
                    RecordedByName = e.RecordedByUser != null ? e.RecordedByUser.DisplayName ?? e.RecordedByUser.Username : null
                }).ToListAsync();

            return Ok(new { items, page, pageSize, totalCount = total });
        }

        // ─── Create ───────────────────────────────────────────────────────────

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ScoreEntryCreateDto dto)
        {
            var (ok, recordedBy, _) = GetCaller();
            if (!ok) return Unauthorized();

            var (hasAccess, allowedIds) = await ResolveAccessAsync();
            if (!hasAccess) return Forbid();
            if (allowedIds != null && !allowedIds.Contains(dto.MemberId)) return Forbid();

            var member = await _db.FamilyMembers.FindAsync(dto.MemberId);
            if (member == null) return NotFound("Member not found.");
            var category = await _db.ScoreCategories.FindAsync(dto.CategoryId);
            if (category == null || !category.IsActive) return NotFound("Score category not found.");
            if (dto.ScoreValue <= 0 || dto.ScoreValue > category.MaxScore)
                return BadRequest($"Score must be between 1 and {category.MaxScore}.");

            var entry = new ScoreEntry { Id = Guid.NewGuid(), MemberId = dto.MemberId, CategoryId = dto.CategoryId, ScoreValue = dto.ScoreValue, Date = dto.Date, Description = dto.Description, RecordedById = recordedBy, CreatedAt = DateTime.UtcNow };
            _db.ScoreEntries.Add(entry);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "AddScore", PerformedBy = User.Identity?.Name ?? "system", Entity = "ScoreEntry", EntityId = entry.Id.ToString(), Details = $"{category.Name}: {dto.ScoreValue} pts for {member.FullName}" });
            return Ok(new { entry.Id, entry.MemberId, MemberName = member.FullName, entry.CategoryId, CategoryName = category.Name, entry.ScoreValue, entry.Date, entry.Description, entry.CreatedAt });
        }

        // ─── Update / Delete ──────────────────────────────────────────────────

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] ScoreEntryUpdateDto dto)
        {
            var (ok, _, role) = GetCaller();
            if (!ok) return Unauthorized();
            var entry = await _db.ScoreEntries.Include(e => e.Category).FirstOrDefaultAsync(e => e.Id == id);
            if (entry == null) return NotFound();
            if (!FullAccessRoles.Contains(role))
            {
                var (hasAccess, allowedIds) = await ResolveAccessAsync();
                if (!hasAccess || (allowedIds != null && !allowedIds.Contains(entry.MemberId))) return Forbid();
            }
            if (dto.ScoreValue.HasValue) { var max = entry.Category?.MaxScore ?? 100; if (dto.ScoreValue.Value <= 0 || dto.ScoreValue.Value > max) return BadRequest($"Score must be between 1 and {max}."); entry.ScoreValue = dto.ScoreValue.Value; }
            if (dto.Description != null) entry.Description = dto.Description;
            await _db.SaveChangesAsync();
            return Ok(new { entry.Id, entry.MemberId, entry.CategoryId, entry.ScoreValue, entry.Date, entry.Description });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var (ok, _, role) = GetCaller();
            if (!ok) return Unauthorized();
            var entry = await _db.ScoreEntries.FindAsync(id);
            if (entry == null) return NotFound();
            if (!FullAccessRoles.Contains(role))
            {
                var (hasAccess, allowedIds) = await ResolveAccessAsync();
                if (!hasAccess || (allowedIds != null && !allowedIds.Contains(entry.MemberId))) return Forbid();
            }
            _db.ScoreEntries.Remove(entry);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ─── Member Summary ───────────────────────────────────────────────────

        [HttpGet("member/{memberId}/summary")]
        public async Task<IActionResult> GetMemberSummary(Guid memberId)
        {
            var (hasAccess, allowedIds) = await ResolveAccessAsync();
            if (!hasAccess) return Forbid();
            if (allowedIds != null && !allowedIds.Contains(memberId)) return Forbid();

            var member = await _db.FamilyMembers.FindAsync(memberId);
            if (member == null) return NotFound();
            var entries = await _db.ScoreEntries.Where(e => e.MemberId == memberId).Include(e => e.Category).ToListAsync();
            var totalScore = entries.Sum(e => e.ScoreValue);
            var count = entries.Count;
            var byCategory = entries.GroupBy(e => new { e.CategoryId, Name = e.Category?.Name ?? "" })
                .Select(g => new { categoryId = g.Key.CategoryId, categoryName = g.Key.Name, totalScore = g.Sum(e => e.ScoreValue), count = g.Count(), averageScore = g.Average(e => (double)e.ScoreValue) })
                .OrderByDescending(x => x.totalScore).ToList();
            return Ok(new { memberId, memberName = member.FullName, totalScore, count, averageScore = count > 0 ? (double)totalScore / count : 0, byCategory });
        }

        // ─── Leaderboards ─────────────────────────────────────────────────────

        [HttpGet("class/{classId}/leaderboard")]
        public async Task<IActionResult> GetClassLeaderboard(Guid classId, [FromQuery] Guid? categoryId)
        {
            var (ok, userId, role) = GetCaller();
            if (!ok) return Unauthorized();
            if (!FullAccessRoles.Contains(role))
            {
                var isAssigned = await _db.Servants.AnyAsync(s => s.UserId == userId && s.ClassId == classId);
                if (!isAssigned) return Forbid();
            }
            var memberIds = await _db.ClassEnrollments.Where(e => e.ClassId == classId).Select(e => e.MemberId).ToListAsync();
            if (!memberIds.Any()) return Ok(new { classId, members = Array.Empty<object>() });
            var query = _db.ScoreEntries.Where(e => memberIds.Contains(e.MemberId));
            if (categoryId.HasValue) query = query.Where(e => e.CategoryId == categoryId.Value);
            var scores = await query.GroupBy(e => e.MemberId).Select(g => new { memberId = g.Key, totalScore = g.Sum(e => e.ScoreValue), count = g.Count() }).ToListAsync();
            var members = await _db.FamilyMembers.Where(m => memberIds.Contains(m.Id)).Select(m => new { m.Id, m.FullName, m.PhotoUrl }).ToListAsync();
            var leaderboard = members.Select(m => { var s = scores.FirstOrDefault(x => x.memberId == m.Id); return new { memberId = m.Id, memberName = m.FullName, photoUrl = m.PhotoUrl, totalScore = s?.totalScore ?? 0, count = s?.count ?? 0 }; })
                .OrderByDescending(x => x.totalScore).Select((x, i) => new { rank = i + 1, x.memberId, x.memberName, x.photoUrl, x.totalScore, x.count }).ToList();
            return Ok(new { classId, categoryId, members = leaderboard });
        }

        [HttpGet("group/{groupId}/leaderboard")]
        public async Task<IActionResult> GetGroupLeaderboard(Guid groupId, [FromQuery] Guid? categoryId)
        {
            var (ok, _, role) = GetCaller();
            if (!ok) return Unauthorized();
            if (!FullAccessRoles.Contains(role)) return Forbid();
            var classes = await _db.Classes.Where(c => c.GroupId == groupId).Select(c => new { c.Id, c.ClassName }).ToListAsync();
            if (!classes.Any()) return Ok(new { groupId, categoryId, classes = Array.Empty<object>() });
            var classIds = classes.Select(c => c.Id).ToList();
            var enrollments = await _db.ClassEnrollments.Where(e => classIds.Contains(e.ClassId)).Select(e => new { e.ClassId, e.MemberId }).ToListAsync();
            var memberIds = enrollments.Select(e => e.MemberId).Distinct().ToList();
            var scoreQuery = _db.ScoreEntries.Where(e => memberIds.Contains(e.MemberId));
            if (categoryId.HasValue) scoreQuery = scoreQuery.Where(e => e.CategoryId == categoryId.Value);
            var scoresByMember = await scoreQuery.GroupBy(e => e.MemberId).Select(g => new { memberId = g.Key, total = g.Sum(e => e.ScoreValue) }).ToListAsync();
            var scoreLookup = scoresByMember.ToDictionary(x => x.memberId, x => x.total);
            var classLeaderboard = classes.Select(c => { var cm = enrollments.Where(e => e.ClassId == c.Id).Select(e => e.MemberId).ToList(); var total = cm.Sum(m => scoreLookup.TryGetValue(m, out var s) ? s : 0); return new { classId = c.Id, className = c.ClassName, totalScore = total, memberCount = cm.Count }; })
                .OrderByDescending(x => x.totalScore).Select((x, i) => new { rank = i + 1, x.classId, x.className, x.totalScore, x.memberCount }).ToList();
            return Ok(new { groupId, categoryId, classes = classLeaderboard });
        }

        // ─── Check duplicate ──────────────────────────────────────────────────

        [HttpGet("member/{memberId}/check")]
        public async Task<IActionResult> CheckExists(Guid memberId, [FromQuery] Guid categoryId, [FromQuery] DateTime date)
        {
            var (hasAccess, allowedIds) = await ResolveAccessAsync();
            if (!hasAccess) return Forbid();
            if (allowedIds != null && !allowedIds.Contains(memberId)) return Forbid();
            var existing = await _db.ScoreEntries.FirstOrDefaultAsync(e => e.MemberId == memberId && e.CategoryId == categoryId && e.Date.Date == date.Date);
            return Ok(new { exists = existing != null, scoreId = existing?.Id, scoreValue = existing?.ScoreValue });
        }

        // ─── Member: available predefined categories ──────────────────────────

        /// <summary>GET /api/scores/my-available-categories — for the logged-in member</summary>
        [HttpGet("my-available-categories")]
        public async Task<IActionResult> GetMyAvailableCategories()
        {
            var (ok, userId, _) = GetCaller();
            if (!ok) return Unauthorized();

            var currentUser = await _db.Users.FindAsync(userId);
            if (currentUser?.FamilyMemberId == null) return Ok(new object[0]);

            var memberId = currentUser.FamilyMemberId.Value;

            // Collect all FamilyMember IDs for this person (same NationalId across families)
            var primaryMember = await _db.FamilyMembers.FindAsync(memberId);
            var allMemberIds = new List<Guid> { memberId };
            if (!string.IsNullOrWhiteSpace(primaryMember?.NationalId))
            {
                var siblings = await _db.FamilyMembers
                    .Where(m => m.NationalId == primaryMember.NationalId && m.Id != memberId)
                    .Select(m => m.Id)
                    .ToListAsync();
                allMemberIds.AddRange(siblings);
            }

            // Find the classes this member (or any of their sibling records) is enrolled in.
            // Note: no early-return when empty — global categories (no ClassId/GroupId) must
            // still be available to members with no active class enrollment.
            var classIds = await _db.ClassEnrollments.Where(e => allMemberIds.Contains(e.MemberId)).Select(e => e.ClassId).ToListAsync();

            // Find the group IDs for those classes
            var groupIds = await _db.Classes.Where(c => classIds.Contains(c.Id) && c.GroupId != null).Select(c => c.GroupId!.Value).Distinct().ToListAsync();

            // Find active predefined categories that match: global, specific class, or specific group
            var categories = await _db.ScoreCategories
                .Where(c => c.IsPredefined && c.IsActive &&
                    (
                        (c.ClassId == null && c.GroupId == null) ||
                        (c.ClassId != null && classIds.Contains(c.ClassId.Value)) ||
                        (c.GroupId != null && groupIds.Contains(c.GroupId.Value))
                    ))
                .Select(c => new { c.Id, c.Name, c.Description, c.MaxScore, c.ClassId, c.GroupId })
                .ToListAsync();

            return Ok(categories);
        }

        // ─── Member: self-report (creates PendingScore) ───────────────────────

        /// <summary>POST /api/scores/member/{memberId}/self-report</summary>
        [HttpPost("member/{memberId}/self-report")]
        public async Task<IActionResult> SelfReport(Guid memberId, [FromBody] SelfReportDto dto)
        {
            var (ok, userId, _) = GetCaller();
            if (!ok) return Unauthorized();

            var currentUser = await _db.Users.FindAsync(userId);
            if (currentUser == null) return Unauthorized();
            if (currentUser.FamilyMemberId != memberId) return Forbid();

            var category = await _db.ScoreCategories.FindAsync(dto.CategoryId);
            if (category == null || !category.IsActive) return NotFound("Category not found.");
            if (!category.IsPredefined) return BadRequest("Self-reporting is only allowed for predefined categories.");

            // Resolve to enrolled member ID (handles same person appearing in multiple families)
            var effectiveMemberId = await ResolveEnrolledMemberIdAsync(memberId);

            // Collect all sibling IDs to check enrollment and duplicates across family records
            var primaryMember = await _db.FamilyMembers.FindAsync(memberId);
            var allMemberIds = new List<Guid> { memberId };
            if (!string.IsNullOrWhiteSpace(primaryMember?.NationalId))
            {
                allMemberIds.AddRange(await _db.FamilyMembers
                    .Where(m => m.NationalId == primaryMember.NationalId && m.Id != memberId)
                    .Select(m => m.Id).ToListAsync());
            }

            // Verify the member is in a class/group that has this category
            var classIds = await _db.ClassEnrollments.Where(e => allMemberIds.Contains(e.MemberId)).Select(e => e.ClassId).ToListAsync();
            var groupIds = await _db.Classes.Where(c => classIds.Contains(c.Id) && c.GroupId != null).Select(c => c.GroupId!.Value).Distinct().ToListAsync();
            bool categoryIsAvailable =
                (category.ClassId == null && category.GroupId == null) ||
                (category.ClassId != null && classIds.Contains(category.ClassId.Value)) ||
                (category.GroupId != null && groupIds.Contains(category.GroupId.Value));
            if (!categoryIsAvailable) return Forbid();

            // Check no duplicate pending for same date (check across all sibling IDs)
            var dateOnly = dto.Date.Date;
            var alreadyPending = await _db.PendingScores.AnyAsync(p =>
                allMemberIds.Contains(p.MemberId) && p.CategoryId == dto.CategoryId && p.Date.Date == dateOnly && p.Status == "Pending");
            if (alreadyPending) return BadRequest($"لديك طلب معلق بالفعل لـ {category.Name} في هذا اليوم.");

            var alreadyApproved = await _db.ScoreEntries.AnyAsync(e => allMemberIds.Contains(e.MemberId) && e.CategoryId == dto.CategoryId && e.Date.Date == dateOnly);
            if (alreadyApproved) return BadRequest($"تم تسجيل درجة بالفعل لـ {category.Name} في هذا اليوم.");

            var pending = new PendingScore
            {
                Id = Guid.NewGuid(),
                MemberId = effectiveMemberId,   // use enrolled member's ID
                CategoryId = dto.CategoryId,
                Date = dto.Date,
                Note = dto.Note,
                Status = "Pending",
                SubmittedById = userId,
                SubmittedAt = DateTime.UtcNow
            };
            _db.PendingScores.Add(pending);
            await _db.SaveChangesAsync();

            // Notify servants of the member's class
            var servantIds = await GetServantUserIdsForClassesAsync(classIds);
            var memberName = (await _db.FamilyMembers.FindAsync(effectiveMemberId))?.FullName ?? "عضو";
            await _notify.NotifyManyAsync(servantIds,
                "طلب درجة جديد",
                $"{memberName} أرسل طلب درجة لـ \"{category.Name}\"",
                "pending_score",
                "/scores");

            return Ok(new { pending.Id, pending.MemberId, pending.CategoryId, CategoryName = category.Name, pending.Date, pending.Status, pending.SubmittedAt });
        }

        // ─── Member: view own pending scores ──────────────────────────────────

        /// <summary>GET /api/scores/my-pending</summary>
        [HttpGet("my-pending")]
        public async Task<IActionResult> GetMyPending()
        {
            var (ok, userId, _) = GetCaller();
            if (!ok) return Unauthorized();
            var currentUser = await _db.Users.FindAsync(userId);
            if (currentUser?.FamilyMemberId == null) return Ok(new object[0]);

            var items = await _db.PendingScores
                .Where(p => p.MemberId == currentUser.FamilyMemberId.Value)
                .OrderByDescending(p => p.SubmittedAt)
                .Select(p => new { p.Id, p.CategoryId, CategoryName = p.Category != null ? p.Category.Name : null, p.Date, p.Note, p.Status, p.SubmittedAt, p.ReviewNote })
                .ToListAsync();
            return Ok(items);
        }

        // ─── Reviewer: list pending scores ────────────────────────────────────

        /// <summary>GET /api/scores/pending — for servants/admins</summary>
        [HttpGet("pending")]
        public async Task<IActionResult> GetPending()
        {
            var (ok, userId, role) = GetCaller();
            if (!ok) return Unauthorized();
            if (!ReviewerRoles.Contains(role)) return Forbid();

            IQueryable<PendingScore> query = _db.PendingScores.Where(p => p.Status == "Pending");

            // Servants only see their class members (including NationalId siblings)
            if (role == "Servant" || role == "DataEntry")
            {
                var classIds = await _db.Servants.Where(s => s.UserId == userId).Select(s => s.ClassId).ToListAsync();
                var enrolledIds = await _db.ClassEnrollments.Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).ToListAsync();

                // Expand to NationalId siblings so pending scores stored under any family record are visible
                var nids = await _db.FamilyMembers
                    .Where(m => enrolledIds.Contains(m.Id) && m.NationalId != null)
                    .Select(m => m.NationalId!).Distinct().ToListAsync();
                var siblingIds = await _db.FamilyMembers
                    .Where(m => nids.Contains(m.NationalId!))
                    .Select(m => m.Id).ToListAsync();
                var allVisibleIds = enrolledIds.Union(siblingIds).ToList();

                query = query.Where(p => allVisibleIds.Contains(p.MemberId));
            }

            var items = await query.OrderBy(p => p.SubmittedAt)
                .Select(p => new
                {
                    p.Id, p.MemberId, MemberName = p.Member != null ? p.Member.FullName : null,
                    p.CategoryId, CategoryName = p.Category != null ? p.Category.Name : null,
                    p.Date, p.Note, p.Status, p.SubmittedAt,
                    SubmittedByName = p.SubmittedBy != null ? p.SubmittedBy.DisplayName ?? p.SubmittedBy.Username : null
                }).ToListAsync();
            return Ok(items);
        }

        // ─── Reviewer: approve ────────────────────────────────────────────────

        /// <summary>POST /api/scores/pending/{id}/approve</summary>
        [HttpPost("pending/{id}/approve")]
        public async Task<IActionResult> ApprovePending(Guid id, [FromBody] ReviewDto dto)
        {
            var (ok, userId, role) = GetCaller();
            if (!ok) return Unauthorized();
            if (!ReviewerRoles.Contains(role)) return Forbid();

            var pending = await _db.PendingScores.Include(p => p.Category).FirstOrDefaultAsync(p => p.Id == id);
            if (pending == null) return NotFound();
            if (pending.Status != "Pending") return BadRequest("This submission is no longer pending.");

            // Resolve the enrolled member ID (handles same person in multiple families)
            var enrolledMemberId = await ResolveEnrolledMemberIdAsync(pending.MemberId);

            // Servant scope check — accept if the enrolled sibling is in their class
            if (role == "Servant" || role == "DataEntry")
            {
                var classIds = await _db.Servants.Where(s => s.UserId == userId).Select(s => s.ClassId).ToListAsync();
                var memberIds = await _db.ClassEnrollments.Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).ToListAsync();
                if (!memberIds.Contains(pending.MemberId) && !memberIds.Contains(enrolledMemberId)) return Forbid();
            }

            pending.Status = "Approved";
            pending.ReviewedById = userId;
            pending.ReviewedAt = DateTime.UtcNow;
            pending.ReviewNote = dto.Note;

            var entry = new ScoreEntry
            {
                Id = Guid.NewGuid(),
                MemberId = enrolledMemberId,    // use enrolled member's ID so leaderboards show it
                CategoryId = pending.CategoryId,
                ScoreValue = pending.Category?.MaxScore ?? 1,
                Date = pending.Date,
                Description = $"تم اعتماده (طلب ذاتي) — {pending.Note}".Trim(' ', '—'),
                RecordedById = userId,
                CreatedAt = DateTime.UtcNow
            };
            _db.ScoreEntries.Add(entry);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "ApprovePendingScore", PerformedBy = User.Identity?.Name ?? "system", Entity = "PendingScore", EntityId = id.ToString(), Details = $"Approved score for member {pending.MemberId}" });

            // Notify the member
            var memberUserId = await GetMemberUserIdAsync(pending.MemberId);
            if (memberUserId.HasValue)
                await _notify.NotifyAsync(memberUserId.Value,
                    "تم قبول درجتك ✓",
                    $"تم اعتماد درجة \"{pending.Category?.Name}\" الخاصة بك",
                    "score_approved",
                    "/");

            return Ok(new { pending.Id, pending.Status, ScoreEntryId = entry.Id });
        }

        // ─── Reviewer: reject ─────────────────────────────────────────────────

        /// <summary>POST /api/scores/pending/{id}/reject</summary>
        [HttpPost("pending/{id}/reject")]
        public async Task<IActionResult> RejectPending(Guid id, [FromBody] ReviewDto dto)
        {
            var (ok, userId, role) = GetCaller();
            if (!ok) return Unauthorized();
            if (!ReviewerRoles.Contains(role)) return Forbid();

            var pending = await _db.PendingScores.FirstOrDefaultAsync(p => p.Id == id);
            if (pending == null) return NotFound();
            if (pending.Status != "Pending") return BadRequest("This submission is no longer pending.");

            if (role == "Servant" || role == "DataEntry")
            {
                var classIds = await _db.Servants.Where(s => s.UserId == userId).Select(s => s.ClassId).ToListAsync();
                var memberIds = await _db.ClassEnrollments.Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).ToListAsync();
                if (!memberIds.Contains(pending.MemberId)) return Forbid();
            }

            pending.Status = "Rejected";
            pending.ReviewedById = userId;
            pending.ReviewedAt = DateTime.UtcNow;
            pending.ReviewNote = dto.Note;
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "RejectPendingScore", PerformedBy = User.Identity?.Name ?? "system", Entity = "PendingScore", EntityId = id.ToString(), Details = $"Rejected score for member {pending.MemberId}" });

            // Notify the member
            var rejectedMemberUserId = await GetMemberUserIdAsync(pending.MemberId);
            if (rejectedMemberUserId.HasValue)
                await _notify.NotifyAsync(rejectedMemberUserId.Value,
                    "طلب الدرجة مرفوض",
                    $"تم رفض طلب الدرجة الخاص بك" + (string.IsNullOrWhiteSpace(dto.Note) ? "" : $" — {dto.Note}"),
                    "score_rejected",
                    "/");

            return Ok(new { pending.Id, pending.Status });
        }
    }
}
