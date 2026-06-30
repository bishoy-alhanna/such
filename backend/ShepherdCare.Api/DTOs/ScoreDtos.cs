using System;

namespace ShepherdCare.Api.DTOs
{
    public class ScoreCategoryCreateDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int MaxScore { get; set; } = 100;
        public bool IsPredefined { get; set; }
        /// <summary>null = global; set = scoped to this class</summary>
        public Guid? ClassId { get; set; }
        /// <summary>null = global; set = scoped to this group</summary>
        public Guid? GroupId { get; set; }
    }

    public class ScoreCategoryUpdateDto
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int? MaxScore { get; set; }
        public bool? IsPredefined { get; set; }
    }

    public class ScoreEntryCreateDto
    {
        public Guid MemberId { get; set; }
        public Guid CategoryId { get; set; }
        public int ScoreValue { get; set; }
        public DateTime Date { get; set; }
        public string? Description { get; set; }
    }

    public class ScoreEntryUpdateDto
    {
        public int? ScoreValue { get; set; }
        public string? Description { get; set; }
    }

    public class SelfReportDto
    {
        public Guid CategoryId { get; set; }
        public DateTime Date { get; set; }
        public string? Note { get; set; }
    }

    public class ReviewDto
    {
        public string? Note { get; set; }
    }
}
