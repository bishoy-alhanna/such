using System;
using System.Collections.Generic;

namespace ShepherdCare.Api.Models
{
    public class Service
    {
        public Guid Id { get; set; }
        public string ServiceName { get; set; } = string.Empty;
        public Guid? ServiceLeaderId { get; set; }
        public string? Description { get; set; }

        public List<Class> Classes { get; set; } = new();
    }
}
