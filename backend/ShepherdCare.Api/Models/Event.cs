namespace ShepherdCare.Api.Models
{
    public class Event
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ChurchId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        /// <summary>Mass, Meeting, Trip, Service, Other</summary>
        public string Type { get; set; } = "Other";
        public DateTime StartDateTime { get; set; }
        public DateTime? EndDateTime { get; set; }
        public string? Location { get; set; }
        public Guid? ClassId { get; set; }
        public Class? Class { get; set; }
        public Guid? GroupId { get; set; }
        public Group? Group { get; set; }
        public bool IsRecurring { get; set; }
        /// <summary>None, Weekly, Monthly</summary>
        public string RecurrenceType { get; set; } = "None";
        public Guid CreatedById { get; set; }
        public User? CreatedByUser { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<EventAttendance> Attendances { get; set; } = new();
    }
}
