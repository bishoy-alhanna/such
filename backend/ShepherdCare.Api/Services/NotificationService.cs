using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;

namespace ShepherdCare.Api.Services
{
    public class NotificationService : INotificationService
    {
        private readonly AppDbContext _db;

        public NotificationService(AppDbContext db)
        {
            _db = db;
        }

        public async Task NotifyAsync(Guid userId, string title, string body, string type, string? link = null)
        {
            _db.Notifications.Add(new Notification
            {
                UserId    = userId,
                Title     = title,
                Body      = body,
                Type      = type,
                Link      = link,
                CreatedAt = DateTime.UtcNow,
            });
            await _db.SaveChangesAsync();
        }

        public async Task NotifyManyAsync(IEnumerable<Guid> userIds, string title, string body, string type, string? link = null)
        {
            var ids = userIds.Distinct().ToList();
            if (ids.Count == 0) return;

            foreach (var uid in ids)
            {
                _db.Notifications.Add(new Notification
                {
                    UserId    = uid,
                    Title     = title,
                    Body      = body,
                    Type      = type,
                    Link      = link,
                    CreatedAt = DateTime.UtcNow,
                });
            }
            await _db.SaveChangesAsync();
        }
    }
}
