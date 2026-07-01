using ShepherdCare.Api.DTOs;
using ShepherdCare.Api.Models;

namespace ShepherdCare.Api.Services
{
    public interface ISubscriptionService
    {
        Task<SubscriptionDto?> GetAsync(Guid churchId);
        Task<SubscriptionUsageDto> GetUsageAsync(Guid churchId);
        Task<(bool Allowed, string? Reason)> CanAddMemberAsync(Guid churchId);
        Task<(bool Allowed, string? Reason)> CanAddServantAsync(Guid churchId);
        Task<bool> IsWriteAllowedAsync(Guid churchId);
    }
}
