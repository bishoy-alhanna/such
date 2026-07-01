using System;

namespace ShepherdCare.Api.Models
{
    public class Visit
    {
        public Guid Id { get; set; }
        public Guid ChurchId { get; set; }
        
        // Visit type: HomeVisit, PhoneCall
        public string VisitType { get; set; } = string.Empty;
        
        // Target type: Member, Family
        public string TargetType { get; set; } = string.Empty;
        
        // Visitor type: Servant, Priest
        public string VisitorType { get; set; } = string.Empty;
        
        // Foreign keys - either MemberId OR FamilyId will be set
        public Guid? MemberId { get; set; }
        public FamilyMember? Member { get; set; }
        
        public Guid? FamilyId { get; set; }
        public Family? Family { get; set; }
        
        public Guid VisitorUserId { get; set; }
        public User? VisitorUser { get; set; }
        
        // Visit details
        public DateTime VisitDate { get; set; }
        public string? Notes { get; set; }
        public string? Purpose { get; set; }
        public string? Outcome { get; set; }
        
        // Follow-up
        public DateTime? NextActionDate { get; set; }
        public bool FollowUpRequired { get; set; }
        
        // Metadata
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
