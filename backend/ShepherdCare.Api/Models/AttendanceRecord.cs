using System;

namespace ShepherdCare.Api.Models
{
    public class AttendanceRecord
    {
        public Guid Id { get; set; }
        public Guid ChurchId { get; set; }
        public Guid MemberId { get; set; }
        public FamilyMember? Member { get; set; }
        public DateTime Date { get; set; }
        public string AttendanceType { get; set; } = string.Empty; // SundaySchool, Mass, Communion, Confession
        public Guid? ClassId { get; set; }
        public Guid RecordedById { get; set; }
        public string? Notes { get; set; }
    }
}
