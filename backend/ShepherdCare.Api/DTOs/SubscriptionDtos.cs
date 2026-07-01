using ShepherdCare.Api.Models;

namespace ShepherdCare.Api.DTOs
{
    public record SubscriptionUsageDto(
        int MemberCount,
        int MemberLimit,
        int MemberPct,
        int ServantCount,
        int ServantLimit,
        int ServantPct
    );

    public record SubscriptionDto(
        Guid               Id,
        Guid               ChurchId,
        string             ChurchName,
        SubscriptionPlan   Plan,
        SubscriptionStatus Status,
        BillingCycle       BillingCycle,
        DateTime           TrialEndsAt,
        int                DaysLeftInTrial,
        DateTime?          PeriodStart,
        DateTime?          PeriodEnd,
        int                MemberLimit,
        int                ServantLimit,
        decimal            MonthlyPrice,
        decimal            AnnualPrice,
        string?            Notes,
        SubscriptionUsageDto Usage
    );

    public record UpdateSubscriptionRequest(
        SubscriptionPlan?   Plan,
        SubscriptionStatus? Status,
        BillingCycle?       BillingCycle,
        DateTime?           TrialEndsAt,
        DateTime?           PeriodStart,
        DateTime?           PeriodEnd,
        string?             Notes
    );
}
