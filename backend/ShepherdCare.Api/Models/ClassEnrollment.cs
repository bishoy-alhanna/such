using System;

namespace ShepherdCare.Api.Models
{
    public class ClassEnrollment
    {
        public Guid Id { get; set; }
        public Guid ClassId { get; set; }
        public Class? Class { get; set; }
        public Guid MemberId { get; set; }
        public FamilyMember? Member { get; set; }
        public string AcademicYear { get; set; } = string.Empty;
    }
}
