using System;

namespace ShepherdCare.Api.Models
{
    public class GivingRecord
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid FamilyId { get; set; }
        public Family? Family { get; set; }
        public decimal Amount { get; set; }
        public DateTime Date { get; set; }
        public string Type { get; set; } = "Tithe"; // Tithe, Pledge, Donation, Building, Other
        public string? Notes { get; set; }
        public bool IsConfidential { get; set; } = true;
        public Guid RecordedById { get; set; }
        public User? RecordedByUser { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
