using System;

namespace ShepherdCare.Api.Models
{
    public class AuditLog
    {
        public Guid Id { get; set; }
        public Guid ChurchId { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string Action { get; set; } = string.Empty;
        public string PerformedBy { get; set; } = string.Empty; // Username or UserId
        public string Entity { get; set; } = string.Empty;
        public string EntityId { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
    }
}
