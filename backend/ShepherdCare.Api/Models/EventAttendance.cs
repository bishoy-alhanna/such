namespace ShepherdCare.Api.Models
{
    public class EventAttendance
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid EventId { get; set; }
        public Event? Event { get; set; }
        public Guid MemberId { get; set; }
        public FamilyMember? Member { get; set; }
        /// <summary>Present, Absent, Excused</summary>
        public string Status { get; set; } = "Present";
        public Guid MarkedById { get; set; }
        public User? MarkedByUser { get; set; }
        public DateTime MarkedAt { get; set; } = DateTime.UtcNow;
    }
}
