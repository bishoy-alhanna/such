using System;
using System.Collections.Generic;

namespace ShepherdCare.Api.Models
{
    public class User
    {
        public Guid Id { get; set; }
        public Guid? ChurchId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
        public Guid RoleId { get; set; }
        public Role? Role { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        /// <summary>Links this system user back to the FamilyMember they represent (servants only).</summary>
        public Guid? FamilyMemberId { get; set; }
        /// <summary>True when the user self-registered and is awaiting admin approval.</summary>
        public bool PendingApproval { get; set; } = false;
        /// <summary>Email address used for weekly digest and notifications.</summary>
        public string? Email { get; set; }
    }
}
