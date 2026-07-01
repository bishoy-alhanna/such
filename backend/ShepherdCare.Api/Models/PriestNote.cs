using System;

namespace ShepherdCare.Api.Models
{
    public class PriestNote
    {
        public Guid Id { get; set; }
        public Guid ChurchId { get; set; }
        public Guid? FamilyId { get; set; }
        public Family? Family { get; set; }
        public Guid? MemberId { get; set; }
        public FamilyMember? Member { get; set; }

        // Encrypted content stored as base64
        public string EncryptedContent { get; set; } = string.Empty;
        public string? Iv { get; set; }

        public Guid CreatedById { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public Guid? UpdatedById { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
