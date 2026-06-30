using System;

namespace ShepherdCare.Api.DTOs
{
    public class AttendanceCreateDto
    {
        public Guid MemberId { get; set; }
        public DateTime Date { get; set; }
        public string AttendanceType { get; set; } = string.Empty;
        public Guid? ClassId { get; set; }
        public Guid RecordedById { get; set; }
        public string? Notes { get; set; }
    }
}
