using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.DTOs;
using ShepherdCare.Api.Models;

namespace ShepherdCare.Api.Services
{
    public class SubscriptionService : ISubscriptionService
    {
        private readonly AppDbContext _db;

        public SubscriptionService(AppDbContext db) => _db = db;

        public async Task<SubscriptionDto?> GetAsync(Guid churchId)
        {
            var sub = await _db.Subscriptions
                .IgnoreQueryFilters()
                .Include(s => s.Church)
                .FirstOrDefaultAsync(s => s.ChurchId == churchId);

            if (sub is null) return null;

            var usage = await GetUsageAsync(churchId);
            return ToDto(sub, usage);
        }

        public async Task<SubscriptionUsageDto> GetUsageAsync(Guid churchId)
        {
            var memberCount = await _db.FamilyMembers
                .IgnoreQueryFilters()
                .CountAsync(m => m.ChurchId == churchId);

            // Servants = any user for this church except Member role
            var memberRoleId = await _db.Roles
                .Where(r => r.Name == "Member")
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            var servantCount = await _db.Users
                .IgnoreQueryFilters()
                .CountAsync(u => u.ChurchId == churchId && u.RoleId != memberRoleId);

            var sub = await _db.Subscriptions
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(s => s.ChurchId == churchId);

            int memberLimit  = sub is null ? PlanLimits.MemberLimit(SubscriptionPlan.Trial)
                                           : PlanLimits.MemberLimit(sub.Plan);
            int servantLimit = sub is null ? PlanLimits.ServantLimit(SubscriptionPlan.Trial)
                                           : PlanLimits.ServantLimit(sub.Plan);

            int memberPct  = memberLimit  == int.MaxValue ? 0 : (int)Math.Round(memberCount  * 100.0 / memberLimit);
            int servantPct = servantLimit == int.MaxValue ? 0 : (int)Math.Round(servantCount * 100.0 / servantLimit);

            return new SubscriptionUsageDto(
                memberCount,  memberLimit  == int.MaxValue ? -1 : memberLimit,  memberPct,
                servantCount, servantLimit == int.MaxValue ? -1 : servantLimit, servantPct);
        }

        public async Task<(bool Allowed, string? Reason)> CanAddMemberAsync(Guid churchId)
        {
            var sub = await _db.Subscriptions.IgnoreQueryFilters()
                .FirstOrDefaultAsync(s => s.ChurchId == churchId);
            if (sub is null) return (true, null);

            var limit = PlanLimits.MemberLimit(sub.Plan);
            if (limit == int.MaxValue) return (true, null);

            var count = await _db.FamilyMembers.IgnoreQueryFilters()
                .CountAsync(m => m.ChurchId == churchId);

            return count >= limit
                ? (false, $"Member limit reached ({limit}). Upgrade your plan to add more members.")
                : (true, null);
        }

        public async Task<(bool Allowed, string? Reason)> CanAddServantAsync(Guid churchId)
        {
            var sub = await _db.Subscriptions.IgnoreQueryFilters()
                .FirstOrDefaultAsync(s => s.ChurchId == churchId);
            if (sub is null) return (true, null);

            var limit = PlanLimits.ServantLimit(sub.Plan);
            if (limit == int.MaxValue) return (true, null);

            var memberRoleId = await _db.Roles
                .Where(r => r.Name == "Member")
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            var count = await _db.Users.IgnoreQueryFilters()
                .CountAsync(u => u.ChurchId == churchId && u.RoleId != memberRoleId);

            return count >= limit
                ? (false, $"Servant/staff limit reached ({limit}). Upgrade your plan to add more staff.")
                : (true, null);
        }

        public async Task<bool> IsWriteAllowedAsync(Guid churchId)
        {
            var sub = await _db.Subscriptions.IgnoreQueryFilters()
                .FirstOrDefaultAsync(s => s.ChurchId == churchId);

            if (sub is null) return true;

            // Expired trial is treated as suspended
            if (sub.Status == SubscriptionStatus.Trial && sub.TrialEndsAt < DateTime.UtcNow)
                return false;

            return sub.Status != SubscriptionStatus.Suspended;
        }

        private static SubscriptionDto ToDto(Subscription s, SubscriptionUsageDto usage)
        {
            int daysLeft = s.Status == SubscriptionStatus.Trial
                ? Math.Max(0, (int)(s.TrialEndsAt - DateTime.UtcNow).TotalDays)
                : 0;

            return new SubscriptionDto(
                s.Id,
                s.ChurchId,
                s.Church?.Name ?? string.Empty,
                s.Plan,
                s.Status,
                s.BillingCycle,
                s.TrialEndsAt,
                daysLeft,
                s.PeriodStart,
                s.PeriodEnd,
                PlanLimits.MemberLimit(s.Plan)  == int.MaxValue ? -1 : PlanLimits.MemberLimit(s.Plan),
                PlanLimits.ServantLimit(s.Plan) == int.MaxValue ? -1 : PlanLimits.ServantLimit(s.Plan),
                PlanLimits.MonthlyPrice(s.Plan),
                PlanLimits.AnnualPrice(s.Plan),
                s.Notes,
                usage
            );
        }
    }
}
