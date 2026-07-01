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
    public class SubscriptionController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ITenantContext _tenant;
        private readonly ISubscriptionService _subs;

        public SubscriptionController(AppDbContext db, ITenantContext tenant, ISubscriptionService subs)
        {
            _db = db; _tenant = tenant; _subs = subs;
        }

        // ── Church: get own subscription ──
        [Authorize]
        [HttpGet]
        public async Task<IActionResult> GetMine()
        {
            if (!_tenant.IsResolved || !_tenant.ChurchId.HasValue)
                return BadRequest("No church context.");

            var sub = await _subs.GetAsync(_tenant.ChurchId.Value);
            return sub is null ? NotFound() : Ok(sub);
        }

        // ── SystemAdmin: list all subscriptions ──
        [Authorize(Roles = "SystemAdmin")]
        [HttpGet("all")]
        public async Task<IActionResult> GetAll()
        {
            var subs = await _db.Subscriptions
                .IgnoreQueryFilters()
                .Include(s => s.Church)
                .OrderBy(s => s.Status)
                .ThenBy(s => s.TrialEndsAt)
                .ToListAsync();

            var result = new List<SubscriptionDto>();
            foreach (var s in subs)
            {
                var usage = await _subs.GetUsageAsync(s.ChurchId);
                result.Add(ToDto(s, usage));
            }
            return Ok(result);
        }

        // ── SystemAdmin: get / update a specific church's subscription ──
        [Authorize(Roles = "SystemAdmin")]
        [HttpGet("church/{churchId:guid}")]
        public async Task<IActionResult> GetForChurch(Guid churchId)
        {
            var sub = await _subs.GetAsync(churchId);
            return sub is null ? NotFound() : Ok(sub);
        }

        [Authorize(Roles = "SystemAdmin")]
        [HttpPut("church/{churchId:guid}")]
        public async Task<IActionResult> UpdateForChurch(Guid churchId, [FromBody] UpdateSubscriptionRequest req)
        {
            var sub = await _db.Subscriptions
                .IgnoreQueryFilters()
                .Include(s => s.Church)
                .FirstOrDefaultAsync(s => s.ChurchId == churchId);

            if (sub is null)
            {
                // Auto-create if church exists
                var church = await _db.Churches.FindAsync(churchId);
                if (church is null) return NotFound("Church not found.");
                sub = new Subscription
                {
                    ChurchId    = churchId,
                    TrialEndsAt = DateTime.UtcNow.AddDays(30),
                };
                _db.Subscriptions.Add(sub);
            }

            if (req.Plan        is not null) sub.Plan         = req.Plan.Value;
            if (req.Status      is not null) sub.Status       = req.Status.Value;
            if (req.BillingCycle is not null) sub.BillingCycle = req.BillingCycle.Value;
            if (req.TrialEndsAt is not null) sub.TrialEndsAt  = req.TrialEndsAt.Value;
            if (req.PeriodStart is not null) sub.PeriodStart  = req.PeriodStart.Value;
            if (req.PeriodEnd   is not null) sub.PeriodEnd    = req.PeriodEnd.Value;
            if (req.Notes       is not null) sub.Notes        = req.Notes;
            sub.UpdatedAt = DateTime.UtcNow;

            // When upgrading to a paid plan, mark as Active
            if (req.Plan is not null && req.Plan != SubscriptionPlan.Trial
                && sub.Status == SubscriptionStatus.Trial)
                sub.Status = SubscriptionStatus.Active;

            await _db.SaveChangesAsync();
            var usage = await _subs.GetUsageAsync(churchId);
            return Ok(ToDto(sub, usage));
        }

        private static SubscriptionDto ToDto(Subscription s, SubscriptionUsageDto usage)
        {
            int daysLeft = s.Status == SubscriptionStatus.Trial
                ? Math.Max(0, (int)(s.TrialEndsAt - DateTime.UtcNow).TotalDays)
                : 0;

            return new SubscriptionDto(
                s.Id, s.ChurchId, s.Church?.Name ?? string.Empty,
                s.Plan, s.Status, s.BillingCycle,
                s.TrialEndsAt, daysLeft,
                s.PeriodStart, s.PeriodEnd,
                PlanLimits.MemberLimit(s.Plan)  == int.MaxValue ? -1 : PlanLimits.MemberLimit(s.Plan),
                PlanLimits.ServantLimit(s.Plan) == int.MaxValue ? -1 : PlanLimits.ServantLimit(s.Plan),
                PlanLimits.MonthlyPrice(s.Plan),
                PlanLimits.AnnualPrice(s.Plan),
                s.Notes, usage);
        }
    }
}
