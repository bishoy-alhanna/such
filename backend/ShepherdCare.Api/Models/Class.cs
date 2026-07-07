using System;
using System.Collections.Generic;

namespace ShepherdCare.Api.Models
{
    public class Class
    {
        public Guid Id { get; set; }
        public Guid ChurchId { get; set; }
        public string ClassName { get; set; } = string.Empty;
        public string? AgeGroup { get; set; }
        public Guid? ServiceId { get; set; }
        public Service? Service { get; set; }
        public Guid? ClassLeaderId { get; set; }
        public Guid? GroupId { get; set; }
        public Group? Group { get; set; }

        public int? MinAge { get; set; }
        public int? MaxAge { get; set; }

        public List<Servant> Servants { get; set; } = new();
        public List<ClassEnrollment> ClassEnrollments { get; set; } = new();
    }
}
