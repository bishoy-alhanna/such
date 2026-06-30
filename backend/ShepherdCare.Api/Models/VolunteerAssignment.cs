using System;

namespace ShepherdCare.Api.Models
{
    public class VolunteerAssignment
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid MemberId { get; set; }
        public FamilyMember? Member { get; set; }
        // Deacon, Reader, Cantor, Setup, Childcare, Hospitality, Other
        public string Role { get; set; } = "Other";
        public DateTime? AssignedDate { get; set; }
        public Guid? EventId { get; set; }
        public Event? Event { get; set; }
        public string? Notes { get; set; }
        public bool IsRecurring { get; set; }
        public Guid CreatedById { get; set; }
        public User? CreatedByUser { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
