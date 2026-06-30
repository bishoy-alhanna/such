namespace ShepherdCare.Api.DTOs;

public class BulkAttendanceDto
{
    public DateTime Date { get; set; }
    public string AttendanceType { get; set; } = string.Empty;
    public List<Guid> MemberIds { get; set; } = new();
    public Guid? ClassId { get; set; }
    public string? Notes { get; set; }
}
