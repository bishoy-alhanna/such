using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ShepherdCare.Api.Data;

namespace ShepherdCare.Api.Services
{
    /// <summary>
    /// Daily background job (runs at ~00:05 UTC) that:
    ///  - Sends birthday notifications to assigned servants
    ///  - Sends name-day (commemorative) notifications to assigned servants
    ///  - Sends wedding-anniversary alerts 7 days before the date
    ///  - Sends confession-gap alerts (weekly, on Mondays) to servants
    ///  - Sends attendance-gap alerts (weekly, on Mondays) to servants
    /// </summary>
    public class PastoralRemindersService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<PastoralRemindersService> _logger;

        private DateOnly _lastWeeklyRun = DateOnly.MinValue;

        public PastoralRemindersService(IServiceScopeFactory scopeFactory, ILogger<PastoralRemindersService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken ct)
        {
            // Wait 1 minute after startup so DB schema migrations are applied first
            await Task.Delay(TimeSpan.FromMinutes(1), ct);

            while (!ct.IsCancellationRequested)
            {
                try
                {
                    var today = DateOnly.FromDateTime(DateTime.UtcNow);
                    await RunDailyAsync(today, ct);

                    if (DateTime.UtcNow.DayOfWeek == DayOfWeek.Monday && _lastWeeklyRun < today)
                    {
                        await RunWeeklyAsync(today, ct);
                        _lastWeeklyRun = today;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "PastoralRemindersService error");
                }

                // Sleep until next 00:05 UTC
                var now = DateTime.UtcNow;
                var next = now.Date.AddDays(1).AddMinutes(5);
                var delay = next - now;
                if (delay <= TimeSpan.Zero) delay = TimeSpan.FromHours(1);
                await Task.Delay(delay, ct);
            }
        }

        // ── Daily: birthdays + name days + anniversaries ─────────────────────────

        private async Task RunDailyAsync(DateOnly today, CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db     = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var notify = scope.ServiceProvider.GetRequiredService<INotificationService>();

            // Birthday notifications
            var birthdays = await db.FamilyMembers
                .Where(m => m.DateOfBirth.HasValue
                         && m.DateOfBirth.Value.Month == today.Month
                         && m.DateOfBirth.Value.Day   == today.Day)
                .Select(m => new { m.Id, m.FullName })
                .ToListAsync(ct);

            foreach (var member in birthdays)
            {
                var servantIds = await GetServantUserIdsAsync(db, member.Id, ct);
                if (servantIds.Count == 0) continue;

                await notify.NotifyManyAsync(servantIds,
                    $"عيد ميلاد — {member.FullName}",
                    $"اليوم هو عيد ميلاد {member.FullName}. لا تنسَ التهنئة!",
                    "birthday_alert",
                    $"/members/{member.Id}");
            }

            // Name-day notifications
            var nameDays = await db.FamilyMembers
                .Where(m => m.NameDayMonth.HasValue && m.NameDayDay.HasValue
                         && m.NameDayMonth.Value == today.Month
                         && m.NameDayDay.Value   == today.Day)
                .Select(m => new { m.Id, m.FullName, m.BaptismName })
                .ToListAsync(ct);

            foreach (var member in nameDays)
            {
                var servantIds = await GetServantUserIdsAsync(db, member.Id, ct);
                if (servantIds.Count == 0) continue;

                var displayName = string.IsNullOrWhiteSpace(member.BaptismName)
                    ? member.FullName : $"{member.FullName} ({member.BaptismName})";

                await notify.NotifyManyAsync(servantIds,
                    $"عيد الاسم — {displayName}",
                    $"اليوم عيد اسم {displayName}. لا تنسَ التهنئة!",
                    "nameday_alert",
                    $"/members/{member.Id}");
            }

            // Wedding-anniversary alerts — 7 days in advance
            var inSevenDays = today.AddDays(7);
            var weddings = await db.SacramentalMilestones
                .Where(ms => ms.Type == "Wedding"
                          && ms.Date.Month == inSevenDays.Month
                          && ms.Date.Day   == inSevenDays.Day)
                .Select(ms => new { ms.MemberId, MemberName = ms.Member!.FullName, ms.Date })
                .ToListAsync(ct);

            foreach (var w in weddings)
            {
                var servantIds = await GetServantUserIdsAsync(db, w.MemberId, ct);
                if (servantIds.Count == 0) continue;

                var years = inSevenDays.Year - w.Date.Year;
                await notify.NotifyManyAsync(servantIds,
                    $"ذكرى زواج قادمة — {w.MemberName}",
                    $"ذكرى زواج {w.MemberName} بعد 7 أيام ({years} سنة).",
                    "anniversary_alert",
                    $"/members/{w.MemberId}");
            }
        }

        // ── Weekly (Monday): confession gaps + attendance gaps ───────────────────

        private async Task RunWeeklyAsync(DateOnly today, CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db     = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var notify = scope.ServiceProvider.GetRequiredService<INotificationService>();

            // Confession gaps > 60 days
            var confessionCutoff = DateTime.UtcNow.AddDays(-60);
            var confessionGaps = await db.FamilyMembers
                .Where(m => !m.IsServant
                         && (m.LastConfessionDate == null || m.LastConfessionDate < confessionCutoff))
                .Select(m => new { m.Id, m.FullName, m.LastConfessionDate })
                .Take(200)
                .ToListAsync(ct);

            foreach (var member in confessionGaps)
            {
                var servantIds = await GetServantUserIdsAsync(db, member.Id, ct);
                if (servantIds.Count == 0) continue;

                var gapText = member.LastConfessionDate == null
                    ? "لم يعترف من قبل"
                    : $"آخر اعتراف منذ {(int)(DateTime.UtcNow - member.LastConfessionDate.Value).TotalDays} يومًا";

                await notify.NotifyManyAsync(servantIds,
                    $"تنبيه اعتراف — {member.FullName}",
                    $"{member.FullName}: {gapText}.",
                    "confession_gap",
                    $"/members/{member.Id}");
            }

            // Attendance gaps: members who haven't attended any session in 4 weeks
            var attendanceCutoff = DateTime.UtcNow.AddDays(-28);
            var enrolled = await db.ClassEnrollments
                .Select(e => new { e.MemberId, e.ClassId })
                .ToListAsync(ct);

            var recentAttendees = await db.AttendanceRecords
                .Where(a => a.Date >= attendanceCutoff)
                .Select(a => a.MemberId)
                .Distinct()
                .ToListAsync(ct);

            var recentSet = recentAttendees.ToHashSet();

            // Find members enrolled in at least one class who have no recent attendance
            var enrolledMemberIds = enrolled.Select(e => e.MemberId).Distinct().ToList();
            var absentMemberIds = enrolledMemberIds.Where(id => !recentSet.Contains(id)).Take(100).ToList();

            if (absentMemberIds.Count > 0)
            {
                var absentMembers = await db.FamilyMembers
                    .Where(m => absentMemberIds.Contains(m.Id))
                    .Select(m => new { m.Id, m.FullName })
                    .ToListAsync(ct);

                foreach (var member in absentMembers)
                {
                    var servantIds = await GetServantUserIdsAsync(db, member.Id, ct);
                    if (servantIds.Count == 0) continue;

                    await notify.NotifyManyAsync(servantIds,
                        $"غياب متكرر — {member.FullName}",
                        $"{member.FullName} لم يحضر أي اجتماع خلال الـ 4 أسابيع الماضية.",
                        "attendance_gap",
                        $"/members/{member.Id}");
                }
            }
        }

        // ── Helpers ─────────────────────────────────────────────────────────────

        private static async Task<List<Guid>> GetServantUserIdsAsync(AppDbContext db, Guid memberId, CancellationToken ct)
        {
            var member = await db.FamilyMembers.FindAsync(new object[] { memberId }, ct);
            var siblingIds = new List<Guid> { memberId };
            if (!string.IsNullOrWhiteSpace(member?.NationalId))
            {
                var extras = await db.FamilyMembers
                    .Where(m => m.NationalId == member.NationalId && m.Id != memberId)
                    .Select(m => m.Id).ToListAsync(ct);
                siblingIds.AddRange(extras);
            }

            var classIds = await db.ClassEnrollments
                .Where(e => siblingIds.Contains(e.MemberId))
                .Select(e => e.ClassId).Distinct().ToListAsync(ct);

            return await db.Servants
                .Where(s => classIds.Contains(s.ClassId))
                .Select(s => s.UserId).Distinct().ToListAsync(ct);
        }
    }
}
