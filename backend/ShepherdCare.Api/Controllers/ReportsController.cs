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
    public class ReportsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public ReportsController(AppDbContext db)
        {
            _db = db;
        }

        /// <summary>GET /api/reports/dashboard-stats — get general statistics</summary>
        [HttpGet("dashboard-stats")]
        public async Task<IActionResult> GetDashboardStats()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var currentUserId))
                return Unauthorized();

            int totalFamilies = 0;
            int totalMembers = 0;
            int totalClasses = 0;
            double? recentAttendanceRate = null;

            if (userRole == "Servant")
            {
                // Get servant's class IDs
                var servantClassIds = await _db.Servants
                    .Where(s => s.UserId == currentUserId)
                    .Select(s => s.ClassId)
                    .ToListAsync();

                if (servantClassIds.Count > 0)
                {
                    // Get enrolled member IDs
                    var enrolledMemberIds = await _db.ClassEnrollments
                        .Where(e => servantClassIds.Contains(e.ClassId))
                        .Select(e => e.MemberId)
                        .Distinct()
                        .ToListAsync();

                    // Count families with at least one enrolled member
                    totalFamilies = await _db.Families
                        .Where(f => f.Members.Any(m => enrolledMemberIds.Contains(m.Id)))
                        .CountAsync();

                    totalMembers = enrolledMemberIds.Count;
                    totalClasses = servantClassIds.Count;

                    // Calculate attendance rate for last 30 days
                    var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
                    var attendanceRecords = await _db.AttendanceRecords
                        .Where(a => a.Date >= thirtyDaysAgo && enrolledMemberIds.Contains(a.MemberId))
                        .CountAsync();

                    var expectedAttendances = enrolledMemberIds.Count * 4; // Assuming 4 weeks
                    if (expectedAttendances > 0)
                    {
                        recentAttendanceRate = (double)attendanceRecords / expectedAttendances * 100;
                    }
                }
            }
            else if (userRole == "Priest")
            {
                // Priest sees data for families assigned to them
                var assignedFamilies = await _db.Families
                    .Where(f => f.AssignedPriestId == currentUserId)
                    .Include(f => f.Members)
                    .ToListAsync();

                totalFamilies = assignedFamilies.Count;
                
                var assignedMemberIds = assignedFamilies
                    .SelectMany(f => f.Members.Select(m => m.Id))
                    .Distinct()
                    .ToList();
                
                totalMembers = assignedMemberIds.Count;

                // Count classes where these members are enrolled
                totalClasses = await _db.ClassEnrollments
                    .Where(e => assignedMemberIds.Contains(e.MemberId))
                    .Select(e => e.ClassId)
                    .Distinct()
                    .CountAsync();

                // Calculate attendance rate for last 30 days
                var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
                var attendanceRecords = await _db.AttendanceRecords
                    .Where(a => a.Date >= thirtyDaysAgo && assignedMemberIds.Contains(a.MemberId))
                    .CountAsync();

                var expectedAttendances = assignedMemberIds.Count * 4; // Assuming 4 weeks
                if (expectedAttendances > 0)
                {
                    recentAttendanceRate = (double)attendanceRecords / expectedAttendances * 100;
                }
            }
            else if (userRole == "ServiceLeader")
            {
                // ServiceLeader sees data for their group's classes
                var leaderGroups = await _db.Groups
                    .Where(g => g.ServantUserId == currentUserId)
                    .Select(g => g.Id)
                    .ToListAsync();

                var groupClassIds = await _db.Classes
                    .Where(c => c.GroupId.HasValue && leaderGroups.Contains(c.GroupId.Value))
                    .Select(c => c.Id)
                    .ToListAsync();

                totalClasses = groupClassIds.Count();

                var groupMemberIds = await _db.ClassEnrollments
                    .Where(e => groupClassIds.Contains(e.ClassId))
                    .Select(e => e.MemberId)
                    .Distinct()
                    .ToListAsync();

                totalMembers = groupMemberIds.Count();

                // Count families with at least one enrolled member
                totalFamilies = await _db.Families
                    .Where(f => f.Members.Any(m => groupMemberIds.Contains(m.Id)))
                    .CountAsync();

                // Calculate attendance rate for last 30 days
                var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
                var attendanceRecords = await _db.AttendanceRecords
                    .Where(a => a.Date >= thirtyDaysAgo && groupMemberIds.Contains(a.MemberId))
                    .CountAsync();

                var expectedAttendances = groupMemberIds.Count() * 4; // Assuming 4 weeks
                if (expectedAttendances > 0)
                {
                    recentAttendanceRate = (double)attendanceRecords / expectedAttendances * 100;
                }
            }
            else
            {
                // SuperAdmin or other roles see all data
                totalFamilies = await _db.Families.CountAsync();
                totalMembers = await _db.FamilyMembers.CountAsync();
                totalClasses = await _db.Classes.CountAsync();

                // Calculate attendance rate for last 30 days
                var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
                var attendanceRecords = await _db.AttendanceRecords
                    .Where(a => a.Date >= thirtyDaysAgo)
                    .CountAsync();

                var allMemberCount = await _db.FamilyMembers.CountAsync();
                var expectedAttendances = allMemberCount * 4; // Assuming 4 weeks
                if (expectedAttendances > 0)
                {
                    recentAttendanceRate = (double)attendanceRecords / expectedAttendances * 100;
                }
            }

            return Ok(new
            {
                TotalFamilies = totalFamilies,
                TotalMembers = totalMembers,
                TotalClasses = totalClasses,
                RecentAttendanceRate = recentAttendanceRate
            });
        }

        /// <summary>GET /api/reports/absent-members — get members with consecutive absences</summary>
        [HttpGet("absent-members")]
        public async Task<IActionResult> GetAbsentMembers(
            [FromQuery] int minAbsences = 3,
            [FromQuery] string? attendanceType = null)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var currentUserId))
                return Unauthorized();

            List<Guid> allowedMemberIds = new List<Guid>();
            bool filterMembers = false;

            if (userRole == "Servant")
            {
                // Get servant's class member IDs
                var servantClassIds = await _db.Servants
                    .Where(s => s.UserId == currentUserId)
                    .Select(s => s.ClassId)
                    .ToListAsync();

                allowedMemberIds = await _db.ClassEnrollments
                    .Where(e => servantClassIds.Contains(e.ClassId))
                    .Select(e => e.MemberId)
                    .Distinct()
                    .ToListAsync();

                if (allowedMemberIds.Count == 0)
                    return Ok(new List<object>());
                
                filterMembers = true;
            }
            else if (userRole == "Priest")
            {
                // Priest sees members from families assigned to them
                var assignedFamilies = await _db.Families
                    .Where(f => f.AssignedPriestId == currentUserId)
                    .Include(f => f.Members)
                    .ToListAsync();

                allowedMemberIds = assignedFamilies
                    .SelectMany(f => f.Members.Select(m => m.Id))
                    .Distinct()
                    .ToList();

                if (allowedMemberIds.Count == 0)
                    return Ok(new List<object>());
                
                filterMembers = true;
            }
            else if (userRole == "ServiceLeader")
            {
                // ServiceLeader sees members from their group's classes
                var leaderGroups = await _db.Groups
                    .Where(g => g.ServantUserId == currentUserId)
                    .Select(g => g.Id)
                    .ToListAsync();

                var groupClassIds = await _db.Classes
                    .Where(c => c.GroupId.HasValue && leaderGroups.Contains(c.GroupId.Value))
                    .Select(c => c.Id)
                    .ToListAsync();

                allowedMemberIds = await _db.ClassEnrollments
                    .Where(e => groupClassIds.Contains(e.ClassId))
                    .Select(e => e.MemberId)
                    .Distinct()
                    .ToListAsync();

                if (allowedMemberIds.Count == 0)
                    return Ok(new List<object>());
                
                filterMembers = true;
            }

            // Get all members with their families
            var membersQuery = _db.FamilyMembers
                .Include(m => m.Family)
                .AsQueryable();

            // Filter by allowed members if needed
            if (filterMembers)
            {
                membersQuery = membersQuery.Where(m => allowedMemberIds.Contains(m.Id));
            }

            var members = await membersQuery.ToListAsync();

            // Define attendance types to check
            var typesToCheck = new List<string>();
            if (string.IsNullOrEmpty(attendanceType) || attendanceType.ToLower() == "all")
            {
                typesToCheck.Add("Mass");
                typesToCheck.Add("SundaySchool");
            }
            else
            {
                typesToCheck.Add(attendanceType);
            }

            var result = new List<object>();

            foreach (var member in members)
            {
                foreach (var type in typesToCheck)
                {
                    // Get attendance records for this member and type
                    var attendanceRecords = await _db.AttendanceRecords
                        .Where(a => a.MemberId == member.Id && a.AttendanceType == type)
                        .OrderByDescending(a => a.Date)
                        .Select(a => a.Date)
                        .ToListAsync();

                    // Use Count to properly detect empty list (FirstOrDefault returns MinValue, not null, for DateTime)
                    bool hasAttendance = attendanceRecords.Count > 0;
                    DateTime? lastAttendanceDate = hasAttendance ? attendanceRecords[0] : (DateTime?)null;

                    // If no attendance records exist, calculate from member creation date
                    DateTime dateToCalculateFrom = hasAttendance
                        ? lastAttendanceDate!.Value.Date
                        : member.CreatedAt.Date;

                    // Count weeks from last attendance (or creation date) to today
                    var today = DateTime.UtcNow.Date;

                    var weeksSinceLastAttendance = (int)((today - dateToCalculateFrom).TotalDays / 7);

                    if (weeksSinceLastAttendance < minAbsences)
                        continue;

                    result.Add(new
                    {
                        MemberId = member.Id,
                        MemberName = member.FullName,
                        FamilyId = member.FamilyId,
                        FamilyName = member.Family?.FamilyName,
                        ConsecutiveAbsences = weeksSinceLastAttendance,
                        LastAttendanceDate = lastAttendanceDate,
                        MemberSince = member.CreatedAt,
                        NeverAttended = !hasAttendance,
                        AttendanceType = type
                    });
                }
            }

            return Ok(result.OrderByDescending(r => ((dynamic)r).ConsecutiveAbsences));
        }

        /// <summary>GET /api/reports/trends?weeks=8 — weekly attendance, spiritual and score trends</summary>
        [HttpGet("trends")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest,Servant,DataEntry")]
        public async Task<IActionResult> GetTrends([FromQuery] int weeks = 8)
        {
            weeks = Math.Clamp(weeks, 2, 26);
            var userId   = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            Guid.TryParse(userId, out var uid);

            // Resolve the member ID scope for this caller
            List<Guid>? scopedMemberIds = null;
            if (userRole == "Servant" || userRole == "DataEntry")
            {
                var classIds = await _db.Servants.Where(s => s.UserId == uid).Select(s => s.ClassId).ToListAsync();
                scopedMemberIds = await _db.ClassEnrollments
                    .Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).Distinct().ToListAsync();
            }
            else if (userRole == "Priest")
            {
                var families = await _db.Families.Where(f => f.AssignedPriestId == uid).Include(f => f.Members).ToListAsync();
                scopedMemberIds = families.SelectMany(f => f.Members.Select(m => m.Id)).Distinct().ToList();
            }
            else if (userRole == "ServiceLeader")
            {
                var gids = await _db.Groups.Where(g => g.ServantUserId == uid).Select(g => g.Id).ToListAsync();
                var cids = await _db.Classes.Where(c => c.GroupId.HasValue && gids.Contains(c.GroupId.Value)).Select(c => c.Id).ToListAsync();
                scopedMemberIds = await _db.ClassEnrollments.Where(e => cids.Contains(e.ClassId)).Select(e => e.MemberId).Distinct().ToListAsync();
            }

            var attendance = new List<object>();
            var spiritual  = new List<object>();
            var scores     = new List<object>();

            var now = DateTime.UtcNow;

            for (int i = weeks - 1; i >= 0; i--)
            {
                var wEnd   = now.AddDays(-i * 7);
                var wStart = wEnd.AddDays(-7);
                var label  = wEnd.ToString("d/M");

                var attQ = _db.AttendanceRecords.Where(a => a.Date >= wStart && a.Date < wEnd);
                var splQ = _db.SpiritualRecords.Where(s => s.Date >= wStart && s.Date < wEnd);
                var scrQ = _db.ScoreEntries.Where(s => s.Date >= wStart && s.Date < wEnd);

                if (scopedMemberIds != null)
                {
                    attQ = attQ.Where(a => scopedMemberIds.Contains(a.MemberId));
                    splQ = splQ.Where(s => scopedMemberIds.Contains(s.MemberId));
                    scrQ = scrQ.Where(s => scopedMemberIds.Contains(s.MemberId));
                }

                var total   = await attQ.CountAsync();
                var mass    = await attQ.CountAsync(a => a.AttendanceType == "Mass");
                var school  = await attQ.CountAsync(a => a.AttendanceType == "SundaySchool");
                var conf    = await splQ.CountAsync(s => s.Type == "Confession");
                var comm    = await splQ.CountAsync(s => s.Type == "Communion");
                var scrCnt  = await scrQ.CountAsync();

                attendance.Add(new { label, total, mass, sundaySchool = school });
                spiritual.Add(new  { label, confession = conf, communion = comm });
                scores.Add(new     { label, count = scrCnt });
            }

            return Ok(new { attendance, spiritual, scores });
        }

        /// <summary>GET /api/reports/class-overview — enrollment + recent attendance rate per class</summary>
        [HttpGet("class-overview")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest,Servant,DataEntry")]
        public async Task<IActionResult> GetClassOverview()
        {
            var userId   = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            Guid.TryParse(userId, out var uid);

            var classQuery = _db.Classes
                .Include(c => c.ClassEnrollments)
                .Include(c => c.Group)
                .AsQueryable();

            if (userRole == "Servant" || userRole == "DataEntry")
            {
                var myClassIds = await _db.Servants.Where(s => s.UserId == uid).Select(s => s.ClassId).ToListAsync();
                classQuery = classQuery.Where(c => myClassIds.Contains(c.Id));
            }
            else if (userRole == "ServiceLeader")
            {
                var gids = await _db.Groups.Where(g => g.ServantUserId == uid).Select(g => g.Id).ToListAsync();
                classQuery = classQuery.Where(c => c.GroupId.HasValue && gids.Contains(c.GroupId.Value));
            }

            var classes     = await classQuery.ToListAsync();
            var fourWeeksAgo = DateTime.UtcNow.AddDays(-28);

            var result = new List<object>();
            foreach (var cls in classes)
            {
                var enrolled   = cls.ClassEnrollments.Count;
                var memberIds  = cls.ClassEnrollments.Select(e => e.MemberId).ToList();
                var attCount   = memberIds.Count == 0 ? 0 :
                    await _db.AttendanceRecords
                        .CountAsync(a => a.Date >= fourWeeksAgo && memberIds.Contains(a.MemberId));
                var expected   = enrolled * 4;
                var rate       = expected > 0 ? Math.Round(attCount * 100.0 / expected, 1) : 0.0;
                var scoreCount = memberIds.Count == 0 ? 0 :
                    await _db.ScoreEntries.CountAsync(s => s.Date >= fourWeeksAgo && memberIds.Contains(s.MemberId));

                result.Add(new
                {
                    classId     = cls.Id,
                    className   = cls.ClassName,
                    groupName   = cls.Group?.Name,
                    enrolled,
                    attCount,
                    attRatePct  = rate,
                    scoreCount,
                });
            }

            return Ok(result.OrderBy(r => ((dynamic)r).className));
        }

        /// <summary>
        /// GET /api/reports/confession-gaps?thresholdDays=30
        /// Returns members whose last confession is older than thresholdDays, or who have never confessed.
        /// Scoped the same way as other report endpoints.
        /// </summary>
        [HttpGet("confession-gaps")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest,Servant,DataEntry")]
        public async Task<IActionResult> GetConfessionGaps([FromQuery] int thresholdDays = 30)
        {
            thresholdDays = Math.Clamp(thresholdDays, 7, 365);
            var userId   = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            Guid.TryParse(userId, out var uid);

            var cutoff = DateTime.UtcNow.AddDays(-thresholdDays);

            // Build base query — only enrolled, non-child adults (isChild = false) and active members
            var memberQuery = _db.FamilyMembers
                .Include(m => m.Family)
                .Where(m => m.LastConfessionDate == null || m.LastConfessionDate < cutoff);

            // Scope to caller's accessible members
            if (userRole == "Servant" || userRole == "DataEntry")
            {
                var classIds = await _db.Servants.Where(s => s.UserId == uid).Select(s => s.ClassId).ToListAsync();
                var memberIds = await _db.ClassEnrollments
                    .Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).Distinct().ToListAsync();
                memberQuery = memberQuery.Where(m => memberIds.Contains(m.Id));
            }
            else if (userRole == "Priest")
            {
                var familyIds = await _db.Families.Where(f => f.AssignedPriestId == uid).Select(f => f.Id).ToListAsync();
                memberQuery = memberQuery.Where(m => familyIds.Contains(m.FamilyId));
            }
            else if (userRole == "ServiceLeader")
            {
                var gids = await _db.Groups.Where(g => g.ServantUserId == uid).Select(g => g.Id).ToListAsync();
                var cids = await _db.Classes.Where(c => c.GroupId.HasValue && gids.Contains(c.GroupId.Value)).Select(c => c.Id).ToListAsync();
                var memberIds = await _db.ClassEnrollments
                    .Where(e => cids.Contains(e.ClassId)).Select(e => e.MemberId).Distinct().ToListAsync();
                memberQuery = memberQuery.Where(m => memberIds.Contains(m.Id));
            }

            var members = await memberQuery
                .OrderBy(m => m.LastConfessionDate ?? DateTime.MinValue)
                .Select(m => new
                {
                    m.Id,
                    m.FullName,
                    m.FamilyId,
                    FamilyName          = m.Family != null ? m.Family.FamilyName : null,
                    m.LastConfessionDate,
                    m.ConfessionFather,
                    GapDays             = m.LastConfessionDate == null
                        ? (int?)null
                        : (int)(DateTime.UtcNow - m.LastConfessionDate.Value).TotalDays,
                    NeverConfessed      = m.LastConfessionDate == null,
                })
                .ToListAsync();

            return Ok(members);
        }

        // ── Helper: resolve scoped member IDs for the caller ─────────────────────
        private async Task<List<Guid>?> ResolveScopedMemberIds(Guid uid, string userRole)
        {
            if (userRole is "SuperAdmin" or "SeniorPriest") return null; // null = no filter
            if (userRole is "Servant" or "DataEntry")
            {
                var classIds = await _db.Servants.Where(s => s.UserId == uid).Select(s => s.ClassId).ToListAsync();
                return await _db.ClassEnrollments.Where(e => classIds.Contains(e.ClassId)).Select(e => e.MemberId).Distinct().ToListAsync();
            }
            if (userRole == "Priest")
            {
                var fids = await _db.Families.Where(f => f.AssignedPriestId == uid).Select(f => f.Id).ToListAsync();
                return await _db.FamilyMembers.Where(m => fids.Contains(m.FamilyId)).Select(m => m.Id).Distinct().ToListAsync();
            }
            if (userRole == "ServiceLeader")
            {
                var gids = await _db.Groups.Where(g => g.ServantUserId == uid).Select(g => g.Id).ToListAsync();
                var cids = await _db.Classes.Where(c => c.GroupId.HasValue && gids.Contains(c.GroupId.Value)).Select(c => c.Id).ToListAsync();
                return await _db.ClassEnrollments.Where(e => cids.Contains(e.ClassId)).Select(e => e.MemberId).Distinct().ToListAsync();
            }
            return null;
        }

        /// <summary>GET /api/reports/class-attendance-trend?classId=&weeks=8</summary>
        [HttpGet("class-attendance-trend")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest,Servant,DataEntry")]
        public async Task<IActionResult> GetClassAttendanceTrend(
            [FromQuery] Guid? classId = null,
            [FromQuery] int weeks = 8)
        {
            weeks = Math.Clamp(weeks, 2, 26);
            var userId   = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "";
            Guid.TryParse(userId, out var uid);

            // Resolve enrolled members for the target class (or caller's scope)
            List<Guid> memberIds;
            string className = "كل الفصول";

            if (classId.HasValue)
            {
                var cls = await _db.Classes.FindAsync(classId.Value);
                className = cls?.ClassName ?? classId.ToString()!;
                memberIds = await _db.ClassEnrollments
                    .Where(e => e.ClassId == classId.Value)
                    .Select(e => e.MemberId).Distinct().ToListAsync();
            }
            else
            {
                var scoped = await ResolveScopedMemberIds(uid, userRole);
                memberIds = scoped ?? await _db.FamilyMembers.Select(m => m.Id).ToListAsync();
            }

            var enrolled = memberIds.Count;
            var now      = DateTime.UtcNow;
            var result   = new List<object>();

            for (int i = weeks - 1; i >= 0; i--)
            {
                var wEnd   = now.AddDays(-i * 7);
                var wStart = wEnd.AddDays(-7);
                var label  = wEnd.ToString("d/M");

                var count = await _db.AttendanceRecords
                    .CountAsync(a => a.Date >= wStart && a.Date < wEnd && memberIds.Contains(a.MemberId));

                var rate = enrolled > 0 ? Math.Round(count * 100.0 / enrolled, 1) : 0.0;
                result.Add(new { label, count, rate, enrolled });
            }

            return Ok(new { className, enrolled, weeks = result });
        }

        /// <summary>GET /api/reports/score-trends?classId=&weeks=12</summary>
        [HttpGet("score-trends")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest,Servant,DataEntry")]
        public async Task<IActionResult> GetScoreTrends(
            [FromQuery] Guid? classId = null,
            [FromQuery] int weeks = 12)
        {
            weeks = Math.Clamp(weeks, 2, 26);
            var userId   = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "";
            Guid.TryParse(userId, out var uid);

            List<Guid> memberIds;
            string scopeName = "الكل";

            if (classId.HasValue)
            {
                var cls = await _db.Classes.FindAsync(classId.Value);
                scopeName = cls?.ClassName ?? "—";
                memberIds = await _db.ClassEnrollments
                    .Where(e => e.ClassId == classId.Value)
                    .Select(e => e.MemberId).Distinct().ToListAsync();
            }
            else
            {
                var scoped = await ResolveScopedMemberIds(uid, userRole);
                memberIds = scoped ?? await _db.FamilyMembers.Select(m => m.Id).ToListAsync();
            }

            var now    = DateTime.UtcNow;
            var result = new List<object>();

            for (int i = weeks - 1; i >= 0; i--)
            {
                var wEnd   = now.AddDays(-i * 7);
                var wStart = wEnd.AddDays(-7);
                var label  = wEnd.ToString("d/M");

                var count = await _db.ScoreEntries
                    .CountAsync(s => s.Date >= wStart && s.Date < wEnd && memberIds.Contains(s.MemberId));

                result.Add(new { label, count });
            }

            return Ok(new { scopeName, weeks = result });
        }

        /// <summary>GET /api/reports/member-growth?months=12</summary>
        [HttpGet("member-growth")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest")]
        public async Task<IActionResult> GetMemberGrowth([FromQuery] int months = 12)
        {
            months = Math.Clamp(months, 3, 24);
            var now    = DateTime.UtcNow;
            var result = new List<object>();

            for (int i = months - 1; i >= 0; i--)
            {
                var mStart = new DateTime(now.Year, now.Month, 1).AddMonths(-i);
                var mEnd   = mStart.AddMonths(1);
                var label  = mStart.ToString("MM/yy");

                var newMembers  = await _db.FamilyMembers.CountAsync(m => m.CreatedAt >= mStart && m.CreatedAt < mEnd);
                var totalSoFar  = await _db.FamilyMembers.CountAsync(m => m.CreatedAt < mEnd);

                result.Add(new { label, newMembers, totalSoFar });
            }

            return Ok(result);
        }

        /// <summary>GET /api/reports/family-growth?months=12</summary>
        [HttpGet("family-growth")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest")]
        public async Task<IActionResult> GetFamilyGrowth([FromQuery] int months = 12)
        {
            months = Math.Clamp(months, 3, 24);
            var now    = DateTime.UtcNow;
            var result = new List<object>();

            for (int i = months - 1; i >= 0; i--)
            {
                var mStart = new DateTime(now.Year, now.Month, 1).AddMonths(-i);
                var mEnd   = mStart.AddMonths(1);
                var label  = mStart.ToString("MM/yy");

                var newFamilies = await _db.Families.CountAsync(f => f.CreatedAt >= mStart && f.CreatedAt < mEnd);
                var totalSoFar  = await _db.Families.CountAsync(f => f.CreatedAt < mEnd);

                result.Add(new { label, newFamilies, totalSoFar });
            }

            return Ok(result);
        }

        /// <summary>GET /api/reports/attendance-summary — get attendance summary for a period</summary>
        [HttpGet("attendance-summary")]
        public async Task<IActionResult> GetAttendanceSummary([FromQuery] string period = "month")
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var currentUserId))
                return Unauthorized();

            // Calculate date range
            var today = DateTime.UtcNow.Date;
            DateTime startDate;

            switch (period.ToLower())
            {
                case "week":
                    startDate = today.AddDays(-7);
                    break;
                case "quarter":
                    startDate = today.AddDays(-90);
                    break;
                case "month":
                default:
                    startDate = today.AddDays(-30);
                    break;
            }

            var query = _db.AttendanceRecords
                .Where(a => a.Date >= startDate)
                .AsQueryable();

            // Filter for role-based access
            if (userRole == "Servant")
            {
                var servantClassIds = await _db.Servants
                    .Where(s => s.UserId == currentUserId)
                    .Select(s => s.ClassId)
                    .ToListAsync();

                var enrolledMemberIds = await _db.ClassEnrollments
                    .Where(e => servantClassIds.Contains(e.ClassId))
                    .Select(e => e.MemberId)
                    .Distinct()
                    .ToListAsync();

                query = query.Where(a => enrolledMemberIds.Contains(a.MemberId));
            }
            else if (userRole == "Priest")
            {
                var assignedFamilies = await _db.Families
                    .Where(f => f.AssignedPriestId == currentUserId)
                    .Include(f => f.Members)
                    .ToListAsync();

                var assignedMemberIds = assignedFamilies
                    .SelectMany(f => f.Members.Select(m => m.Id))
                    .Distinct()
                    .ToList();

                query = query.Where(a => assignedMemberIds.Contains(a.MemberId));
            }
            else if (userRole == "ServiceLeader")
            {
                var leaderGroups = await _db.Groups
                    .Where(g => g.ServantUserId == currentUserId)
                    .Select(g => g.Id)
                    .ToListAsync();

                var groupClassIds = await _db.Classes
                    .Where(c => c.GroupId.HasValue && leaderGroups.Contains(c.GroupId.Value))
                    .Select(c => c.Id)
                    .ToListAsync();

                var groupMemberIds = await _db.ClassEnrollments
                    .Where(e => groupClassIds.Contains(e.ClassId))
                    .Select(e => e.MemberId)
                    .Distinct()
                    .ToListAsync();

                query = query.Where(a => groupMemberIds.Contains(a.MemberId));
            }

            var records = await query.ToListAsync();

            var totalRecords = records.Count;
            var massAttendance = records.Count(r => r.AttendanceType == "Mass");
            var sundaySchoolAttendance = records.Count(r => r.AttendanceType == "SundaySchool");
            var uniqueMembers = records.Select(r => r.MemberId).Distinct().Count();

            return Ok(new
            {
                TotalRecords = totalRecords,
                MassAttendance = massAttendance,
                SundaySchoolAttendance = sundaySchoolAttendance,
                UniqueMembers = uniqueMembers
            });
        }
    }
}
