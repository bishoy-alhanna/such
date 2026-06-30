using System;

namespace ShepherdCare.Api.Models
{
    public class ScoreEntry
    {
        public Guid Id { get; set; }
        public Guid MemberId { get; set; }
        public FamilyMember? Member { get; set; }
        public Guid CategoryId { get; set; }
        public ScoreCategory? Category { get; set; }
        public int ScoreValue { get; set; }
        public DateTime Date { get; set; }
        public string? Description { get; set; }
        public Guid RecordedById { get; set; }
        public User? RecordedByUser { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
