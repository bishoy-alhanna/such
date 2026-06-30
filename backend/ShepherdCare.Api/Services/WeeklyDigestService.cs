using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;

namespace ShepherdCare.Api.Services
{
    public class WeeklyDigestService : BackgroundService
    {
        private static readonly string[] LeaderRoles = { "SuperAdmin", "ServiceLeader", "Priest", "SeniorPriest" };
        private readonly IServiceProvider _services;
        private readonly ILogger<WeeklyDigestService> _log;
        private DateOnly _lastSentDate = DateOnly.MinValue;

        // Send on this day of week at this UTC hour (configurable via env vars)
        private readonly DayOfWeek _sendDay;
        private readonly int _sendHour;

        public WeeklyDigestService(IServiceProvider services, ILogger<WeeklyDigestService> log)
        {
            _services = services;
            _log      = log;
            _sendDay  = Enum.TryParse<DayOfWeek>(Environment.GetEnvironmentVariable("DIGEST_DAY"), out var d) ? d : DayOfWeek.Monday;
            _sendHour = int.TryParse(Environment.GetEnvironmentVariable("DIGEST_HOUR_UTC"), out var h) ? h : 6;
        }

        protected override async Task ExecuteAsync(CancellationToken ct)
        {
            _log.LogInformation("WeeklyDigestService started. Will send on {Day} at {Hour}:00 UTC", _sendDay, _sendHour);

            while (!ct.IsCancellationRequested)
            {
                var now = DateTime.UtcNow;
                if (now.DayOfWeek == _sendDay && now.Hour == _sendHour)
                {
                    var today = DateOnly.FromDateTime(now);
                    if (_lastSentDate != today)
                    {
                        _lastSentDate = today;
                        await TrySendDigestAsync(ct);
                    }
                }
                await Task.Delay(TimeSpan.FromHours(1), ct);
            }
        }

        private async Task TrySendDigestAsync(CancellationToken ct)
        {
            _log.LogInformation("Preparing weekly digest email");
            try
            {
                using var scope = _services.CreateScope();
                var db    = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var email = scope.ServiceProvider.GetRequiredService<IEmailService>();

                if (!email.IsConfigured)
                {
                    _log.LogWarning("SMTP not configured — skipping weekly digest");
                    return;
                }

                var data      = await BuildDigestDataAsync(db, ct);
                var subject   = $"ShepherdCare — التقرير الأسبوعي ({data.WeekLabel})";
                var htmlBody  = BuildHtmlEmail(data);

                var recipients = await db.Users
                    .Include(u => u.Role)
                    .Where(u => u.IsActive && !string.IsNullOrEmpty(u.Email) && LeaderRoles.Contains(u.Role!.Name))
                    .Select(u => u.Email!)
                    .Distinct()
                    .ToListAsync(ct);

                if (recipients.Count == 0)
                {
                    _log.LogWarning("No leader recipients with email addresses configured");
                    return;
                }

                await email.SendManyAsync(recipients, subject, htmlBody);
                _log.LogInformation("Weekly digest sent to {Count} recipients", recipients.Count);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to send weekly digest");
            }
        }

        private static async Task<DigestData> BuildDigestDataAsync(AppDbContext db, CancellationToken ct)
        {
            var now       = DateTime.UtcNow;
            var thisWeek  = now.AddDays(-7);
            var lastWeek  = now.AddDays(-14);

            // Attendance
            var attendThisWeek = await db.AttendanceRecords.CountAsync(a => a.Date >= thisWeek, ct);
            var attendLastWeek = await db.AttendanceRecords.CountAsync(a => a.Date >= lastWeek && a.Date < thisWeek, ct);
            var massThisWeek   = await db.AttendanceRecords.CountAsync(a => a.Date >= thisWeek && a.AttendanceType == "Mass", ct);

            // Spiritual
            var confThisWeek = await db.SpiritualRecords.CountAsync(s => s.Date >= thisWeek && s.Type == "Confession", ct);
            var commThisWeek = await db.SpiritualRecords.CountAsync(s => s.Date >= thisWeek && s.Type == "Communion", ct);

            // Scores
            var scoresThisWeek = await db.ScoreEntries.CountAsync(s => s.Date >= thisWeek, ct);

            // Pending work
            var pendingScores  = await db.PendingScores.CountAsync(p => p.Status == "Pending", ct);
            var pendingUpdates = await db.PendingMemberUpdates.CountAsync(p => p.Status == "Pending", ct);

            // Members with 3+ weeks absence (using last attendance date)
            var threeWeeksAgo   = now.AddDays(-21);
            var totalMembers    = await db.FamilyMembers.CountAsync(ct);
            var recentlyActiveIds = await db.AttendanceRecords
                .Where(a => a.Date >= threeWeeksAgo)
                .Select(a => a.MemberId)
                .Distinct()
                .ToListAsync(ct);
            var inactiveCount = totalMembers - recentlyActiveIds.Count;

            // 8-week attendance trend
            var trend = new List<WeekTrend>();
            for (int i = 7; i >= 0; i--)
            {
                var wEnd   = now.AddDays(-i * 7);
                var wStart = wEnd.AddDays(-7);
                var count  = await db.AttendanceRecords.CountAsync(a => a.Date >= wStart && a.Date < wEnd, ct);
                trend.Add(new WeekTrend
                {
                    Label = wEnd.ToString("d/M"),
                    Count = count,
                });
            }

            return new DigestData
            {
                WeekLabel       = $"{thisWeek:d/M} – {now:d/M/yyyy}",
                AttendThisWeek  = attendThisWeek,
                AttendLastWeek  = attendLastWeek,
                MassThisWeek    = massThisWeek,
                ConfThisWeek    = confThisWeek,
                CommThisWeek    = commThisWeek,
                ScoresThisWeek  = scoresThisWeek,
                PendingScores   = pendingScores,
                PendingUpdates  = pendingUpdates,
                InactiveCount   = inactiveCount < 0 ? 0 : inactiveCount,
                TotalMembers    = totalMembers,
                Trend           = trend,
            };
        }

        private static string BuildHtmlEmail(DigestData d)
        {
            var attendChange = d.AttendLastWeek > 0
                ? (int)Math.Round((d.AttendThisWeek - d.AttendLastWeek) * 100.0 / d.AttendLastWeek)
                : 0;
            var arrow     = attendChange >= 0 ? "↑" : "↓";
            var arrowColor = attendChange >= 0 ? "#16a34a" : "#dc2626";

            var trendBars = string.Join("", d.Trend.Select(w =>
            {
                var maxVal = d.Trend.Max(x => x.Count);
                var barH   = maxVal > 0 ? (int)(w.Count * 40.0 / maxVal) : 0;
                return $@"<td style=""text-align:center;vertical-align:bottom;padding:0 4px;"">
                    <div style=""background:#6366f1;width:24px;height:{barH}px;margin:0 auto;border-radius:3px 3px 0 0;""></div>
                    <div style=""font-size:9px;color:#9ca3af;margin-top:2px;"">{w.Label}</div>
                </td>";
            }));

            return $@"<!DOCTYPE html>
<html dir=""rtl"" lang=""ar"">
<head><meta charset=""UTF-8""><meta name=""viewport"" content=""width=device-width,initial-scale=1"">
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 0; color: #111827; }}
  .wrap {{ max-width: 600px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
  .header {{ background: linear-gradient(135deg, #1e1b4b, #4f46e5); padding: 28px 32px; color: #fff; }}
  .header h1 {{ margin: 0 0 4px; font-size: 22px; }}
  .header p  {{ margin: 0; opacity: 0.7; font-size: 13px; }}
  .body  {{ padding: 28px 32px; }}
  .grid  {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }}
  .card  {{ background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }}
  .card .label {{ font-size: 11px; color: #6b7280; margin-bottom: 6px; }}
  .card .value {{ font-size: 28px; font-weight: 700; color: #1f2937; line-height: 1; }}
  .card .sub   {{ font-size: 12px; color: #9ca3af; margin-top: 4px; }}
  .section-title {{ font-size: 13px; font-weight: 600; color: #374151; margin: 20px 0 12px; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; }}
  .alert {{ background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #9a3412; margin-bottom: 16px; }}
  .footer {{ background: #f9fafb; padding: 16px 32px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; }}
</style>
</head>
<body>
<div class=""wrap"">
  <div class=""header"">
    <h1>ShepherdCare — التقرير الأسبوعي</h1>
    <p>{d.WeekLabel}</p>
  </div>
  <div class=""body"">

    {(d.PendingScores + d.PendingUpdates > 0 ? $@"
    <div class=""alert"">
      ⚠️ لديك <strong>{d.PendingScores + d.PendingUpdates}</strong> طلب معلق يحتاج مراجعة
      ({d.PendingScores} درجات، {d.PendingUpdates} تعديلات بيانات)
    </div>" : "")}

    <div class=""section-title"">الحضور هذا الأسبوع</div>
    <div class=""grid"">
      <div class=""card"">
        <div class=""label"">إجمالي الحضور</div>
        <div class=""value"">{d.AttendThisWeek}</div>
        <div class=""sub""><span style=""color:{arrowColor}"">{arrow} {Math.Abs(attendChange)}%</span> مقارنة بالأسبوع الماضي</div>
      </div>
      <div class=""card"">
        <div class=""label"">حضور القداس</div>
        <div class=""value"">{d.MassThisWeek}</div>
      </div>
      <div class=""card"">
        <div class=""label"">الأعضاء غير النشطين (+3 أسابيع)</div>
        <div class=""value"" style=""color:{(d.InactiveCount > 0 ? "#dc2626" : "#16a34a")}"">{d.InactiveCount}</div>
        <div class=""sub"">من إجمالي {d.TotalMembers} عضو</div>
      </div>
    </div>

    <div class=""section-title"">الحياة الروحية</div>
    <div class=""grid"">
      <div class=""card"">
        <div class=""label"">الاعترافات</div>
        <div class=""value"">{d.ConfThisWeek}</div>
      </div>
      <div class=""card"">
        <div class=""label"">التناول</div>
        <div class=""value"">{d.CommThisWeek}</div>
      </div>
      <div class=""card"">
        <div class=""label"">الدرجات المسجلة</div>
        <div class=""value"">{d.ScoresThisWeek}</div>
      </div>
    </div>

    <div class=""section-title"">توجه الحضور — آخر 8 أسابيع</div>
    <table style=""width:100%;border-collapse:collapse;"" cellpadding=""0"" cellspacing=""0"">
      <tr style=""vertical-align:bottom;height:48px;"">
        {trendBars}
      </tr>
    </table>

  </div>
  <div class=""footer"">
    تم إرسال هذا التقرير تلقائياً بواسطة ShepherdCare &nbsp;·&nbsp; يمكنك إيقاف الإشعارات من إعدادات حسابك
  </div>
</div>
</body>
</html>";
        }

        private class DigestData
        {
            public string WeekLabel       { get; set; } = "";
            public int AttendThisWeek     { get; set; }
            public int AttendLastWeek     { get; set; }
            public int MassThisWeek       { get; set; }
            public int ConfThisWeek       { get; set; }
            public int CommThisWeek       { get; set; }
            public int ScoresThisWeek     { get; set; }
            public int PendingScores      { get; set; }
            public int PendingUpdates     { get; set; }
            public int InactiveCount      { get; set; }
            public int TotalMembers       { get; set; }
            public List<WeekTrend> Trend  { get; set; } = new();
        }

        private class WeekTrend
        {
            public string Label { get; set; } = "";
            public int Count    { get; set; }
        }
    }
}
