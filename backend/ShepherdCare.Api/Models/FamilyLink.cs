using System;

namespace ShepherdCare.Api.Models
{
    public class FamilyLink
    {
        public Guid Id { get; set; }

        public Guid FamilyId { get; set; }
        public Family? Family { get; set; }

        public Guid LinkedFamilyId { get; set; }
        public Family? LinkedFamily { get; set; }

        /// <summary>
        /// Free-text label describing the relationship from FamilyId's perspective.
        /// e.g. "Son's family", "Parent's family", "Sibling family"
        /// </summary>
        public string? RelationLabel { get; set; }
    }
}
