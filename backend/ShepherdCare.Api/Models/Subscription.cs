namespace ShepherdCare.Api.Models
{
    public enum SubscriptionPlan { Trial, Starter, Church, Parish, Diocese }
    public enum SubscriptionStatus { Trial, Active, PastDue, Suspended }
    public enum BillingCycle { Monthly, Annual }

    public static class PlanLimits
    {
        private record PlanDef(int Members, int Servants, decimal Monthly);

        private static readonly Dictionary<SubscriptionPlan, PlanDef> _plans = new()
        {
            [SubscriptionPlan.Trial]   = new(150,        5,              0m),
            [SubscriptionPlan.Starter] = new(150,        5,              19m),
            [SubscriptionPlan.Church]  = new(500,        20,             39m),
            [SubscriptionPlan.Parish]  = new(1500,       int.MaxValue,   69m),
            [SubscriptionPlan.Diocese] = new(int.MaxValue, int.MaxValue, 0m),
        };

        public static int    MemberLimit(SubscriptionPlan p)  => _plans[p].Members;
        public static int    ServantLimit(SubscriptionPlan p) => _plans[p].Servants;
        public static decimal MonthlyPrice(SubscriptionPlan p) => _plans[p].Monthly;
        public static decimal AnnualPrice(SubscriptionPlan p)  => _plans[p].Monthly * 10; // 2 months free
    }

    public class Subscription
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ChurchId { get; set; }
        public Church? Church { get; set; }

        public SubscriptionPlan   Plan        { get; set; } = SubscriptionPlan.Trial;
        public SubscriptionStatus Status      { get; set; } = SubscriptionStatus.Trial;
        public BillingCycle       BillingCycle { get; set; } = BillingCycle.Monthly;

        public DateTime  TrialEndsAt  { get; set; }
        public DateTime? PeriodStart  { get; set; }
        public DateTime? PeriodEnd    { get; set; }

        public string? Notes { get; set; }

        public DateTime  CreatedAt  { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt  { get; set; }
    }
}
