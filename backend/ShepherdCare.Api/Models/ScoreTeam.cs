namespace ShepherdCare.Api.Models
{
    public class ScoreTeam
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = "";
        public Guid? ClassId { get; set; }
        public Guid? GroupId { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public Guid CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public List<ScoreTeamMember> Members { get; set; } = [];
    }

    public class ScoreTeamMember
    {
        public Guid ScoreTeamId { get; set; }
        public Guid MemberId { get; set; }
        public ScoreTeam? ScoreTeam { get; set; }
        public FamilyMember? Member { get; set; }
    }
}
