namespace ShepherdCare.Api.Models
{
    public class SacramentalMilestone
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid MemberId { get; set; }
        public FamilyMember? Member { get; set; }

        /// <summary>
        /// One of: Baptism, Chrismation, FirstCommunion, FirstConfession,
        /// Wedding, Ordination, Tonsure, Consecration, Other
        /// </summary>
        public string Type { get; set; } = string.Empty;

        public DateTime Date { get; set; }
        public string? Notes { get; set; }

        public Guid RecordedById { get; set; }
        public User? RecordedByUser { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
