using System;
using System.Collections.Generic;

namespace ShepherdCare.Api.DTOs
{
    public class FamilyCreateDto
    {
        public string FamilyName { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? Area { get; set; }
        public string? PhoneNumbers { get; set; }
        public Guid? AssignedPriestId { get; set; }
        public string? Status { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
    }

    public class FamilyDto : FamilyCreateDto
    {
        public Guid Id { get; set; }
    }
}
