using System;

namespace ShepherdCare.Api.Models
{
    public class ServiceHours
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid MemberId { get; set; }
        public FamilyMember? Member { get; set; }
        public DateTime Date { get; set; }
        public decimal Hours { get; set; }
        public string Activity { get; set; } = "";
        public string? Notes { get; set; }
        public Guid RecordedById { get; set; }
        public User? RecordedByUser { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
