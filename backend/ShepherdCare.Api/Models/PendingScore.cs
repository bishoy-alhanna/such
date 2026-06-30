using System;

namespace ShepherdCare.Api.Models
{
    public class PendingScore
    {
        public Guid Id { get; set; }
        public Guid MemberId { get; set; }
        public FamilyMember? Member { get; set; }
        public Guid CategoryId { get; set; }
        public ScoreCategory? Category { get; set; }
        public DateTime Date { get; set; }
        public string? Note { get; set; }
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
