using System;

namespace ShepherdCare.Api.DTOs
{
    public class SignupDto
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        /// <summary>14-digit Egyptian National ID of the registering user.</summary>
        public string NationalId { get; set; } = string.Empty;
        /// <summary>Required when no FamilyMember with this NationalId exists.</summary>
        public string? FullName { get; set; }
        public string? Gender { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? Mobile { get; set; }
        /// <summary>Father's National ID used to find (or create) the family when member is not found.</summary>
        public string? FatherNationalId { get; set; }
        /// <summary>For married females: husband's National ID to find/create marital family.</summary>
        public string? HusbandNationalId { get; set; }
        public bool IsMarried { get; set; }
    }

    public class ApproveUserDto
    {
        public Guid RoleId { get; set; }
    }

    public class NationalIdCheckResult
    {
        public bool Found { get; set; }
        public string? MemberName { get; set; }
        public bool AlreadyRegistered { get; set; }
    }
}
