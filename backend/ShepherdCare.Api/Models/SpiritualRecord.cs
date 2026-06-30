using System;

namespace ShepherdCare.Api.Models
{
    /// <summary>
    /// Tracks confession, communion, and call events for a member.
    /// The member's LastConfessionDate / LastCommunionDate / LastCallDate
    /// are kept in sync automatically whenever a record is added or deleted.
    /// </summary>
    public class SpiritualRecord
    {
        public Guid Id { get; set; }

        public Guid MemberId { get; set; }
        public FamilyMember? Member { get; set; }

        /// <summary>Confession | Communion | Call</summary>
        public string Type { get; set; } = string.Empty;

        public DateTime Date { get; set; }

        public string? Notes { get; set; }

        public Guid RecordedBy { get; set; }
        public User? RecordedByUser { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
