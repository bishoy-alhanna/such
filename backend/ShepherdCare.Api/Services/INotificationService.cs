namespace ShepherdCare.Api.Services
{
    public interface INotificationService
    {
        Task NotifyAsync(Guid userId, string title, string body, string type, string? link = null);
        Task NotifyManyAsync(IEnumerable<Guid> userIds, string title, string body, string type, string? link = null);
    }
}
