using System;

namespace ShepherdCare.Api.DTOs
{
    public class ServiceCreateDto
    {
        public string ServiceName { get; set; } = string.Empty;
        public Guid? ServiceLeaderId { get; set; }
        public string? Description { get; set; }
    }

    public class ClassCreateDto
    {
        public string ClassName { get; set; } = string.Empty;
        public string? AgeGroup { get; set; }
        public Guid ServiceId { get; set; }
        public Guid? ClassLeaderId { get; set; }
    }
}
