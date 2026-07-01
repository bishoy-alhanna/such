namespace ShepherdCare.Api.Models
{
    public class FollowUpTask
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ChurchId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public DateTime? DueDate { get; set; }
        /// <summary>Open, Done, Cancelled</summary>
        public string Status { get; set; } = "Open";
        public Guid AssignedToUserId { get; set; }
        public User? AssignedToUser { get; set; }
        public Guid? RelatedMemberId { get; set; }
        public FamilyMember? RelatedMember { get; set; }
        public Guid? RelatedVisitId { get; set; }
        public Visit? RelatedVisit { get; set; }
        public Guid CreatedById { get; set; }
        public User? CreatedByUser { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt { get; set; }
    }
}
