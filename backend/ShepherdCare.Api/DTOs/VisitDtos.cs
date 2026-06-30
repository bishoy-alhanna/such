using System;

namespace ShepherdCare.Api.DTOs
{
    public class VisitCreateDto
    {
        public Guid FamilyId { get; set; }
        public Guid PerformedById { get; set; }
        public DateTime VisitDate { get; set; }
        public string? VisitType { get; set; }
        public string? Outcome { get; set; }
        public DateTime? NextActionDate { get; set; }
        public bool FollowUpRequired { get; set; }
    }
}
