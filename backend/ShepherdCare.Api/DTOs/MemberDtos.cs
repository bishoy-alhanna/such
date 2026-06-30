using System;

namespace ShepherdCare.Api.DTOs
{
    public class MemberCreateDto
    {
        public Guid FamilyId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string? Gender { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? Relation { get; set; }
        public string? Mobile { get; set; }
        public bool IsChild { get; set; }
        public string? Notes { get; set; }
        public string? NationalId { get; set; }
        // Education / Work
        public string? OccupationStatus { get; set; }
        public string? StudyYear { get; set; }
        public string? College { get; set; }
        public string? JobTitle { get; set; }
        public string? JobDetails { get; set; }
        public string? Qualification { get; set; }
        // Church
        public string? Church { get; set; }
        public string? MeetingAttended { get; set; }
        public string? ConfessionFather { get; set; }
        public DateTime? LastConfessionDate { get; set; }
        public DateTime? LastCommunionDate { get; set; }
        public DateTime? LastCallDate { get; set; }
        // Service
        public bool IsServant { get; set; }
        public string? ServiceType { get; set; }
        // Coptic identity
        public string? BaptismName { get; set; }
        public int? NameDayMonth { get; set; }
        public int? NameDayDay { get; set; }
        // Misc
        public string? Status { get; set; }
        public string? PhotoUrl { get; set; }
    }

    public class MemberDto : MemberCreateDto
    {
        public Guid Id { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class LinkUserDto { public string Username { get; set; } = string.Empty; }

    /// <summary>Fields a member can update on their own profile (admin-managed fields are excluded).</summary>
    public class ProfileUpdateDto
    {
        public string? Mobile { get; set; }
        public string? Gender { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? OccupationStatus { get; set; }
        public string? StudyYear { get; set; }
        public string? College { get; set; }
        public string? JobTitle { get; set; }
        public string? JobDetails { get; set; }
        public string? Qualification { get; set; }
        public string? Church { get; set; }
        public string? MeetingAttended { get; set; }
        public string? ConfessionFather { get; set; }
        public DateTime? LastConfessionDate { get; set; }
        public DateTime? LastCommunionDate { get; set; }
        public string? Notes { get; set; }
        public string? BaptismName { get; set; }
        public int? NameDayMonth { get; set; }
        public int? NameDayDay { get; set; }
    }
}
