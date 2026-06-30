using System;

namespace ShepherdCare.Api.Models
{
    public class PendingMemberUpdate
    {
        public Guid Id { get; set; }
        public Guid MemberId { get; set; }
        public FamilyMember? Member { get; set; }
        /// <summary>JSON object of changed fields, e.g. {"mobile":"01234","church":"St Mary"}</summary>
        public string ChangesJson { get; set; } = "{}";
        /// <summary>Pending | Approved | Rejected</summary>
        public string Status { get; set; } = "Pending";
        public Guid SubmittedById { get; set; }
        public User? SubmittedBy { get; set; }
        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
        public Guid? ReviewedById { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? ReviewNote { get; set; }
    }
}
