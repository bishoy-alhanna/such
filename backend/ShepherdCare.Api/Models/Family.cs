using System;
using System.Collections.Generic;

namespace ShepherdCare.Api.Models
{
    public class Family
    {
        public Guid Id { get; set; }
        public Guid ChurchId { get; set; }
        public string FamilyName { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? Area { get; set; }
        public string? PhoneNumbers { get; set; }
        public Guid? AssignedPriestId { get; set; }
        public string? Status { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<FamilyMember> Members { get; set; } = new();
        public List<PriestNote> PriestNotes { get; set; } = new();
        public List<FamilyLink> FamilyLinks { get; set; } = new();
    }
}
