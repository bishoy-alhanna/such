using System;

namespace ShepherdCare.Api.Models
{
    public class Pledge
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid FamilyId { get; set; }
        public Family? Family { get; set; }
        public int Year { get; set; }
        public decimal PledgedAmount { get; set; }
        public string? Notes { get; set; }
        public bool IsActive { get; set; } = true;
        public Guid CreatedById { get; set; }
        public User? CreatedByUser { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
