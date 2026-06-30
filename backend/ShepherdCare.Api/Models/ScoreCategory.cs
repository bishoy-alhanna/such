using System;

namespace ShepherdCare.Api.Models
{
    public class ScoreCategory
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int MaxScore { get; set; } = 100;
        public bool IsPredefined { get; set; }
        public bool IsActive { get; set; } = true;
        /// <summary>null = global; set = scoped to this class only</summary>
        public Guid? ClassId { get; set; }
        /// <summary>null = global; set = scoped to all classes in this group</summary>
        public Guid? GroupId { get; set; }
        public Guid CreatedById { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
