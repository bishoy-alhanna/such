namespace ShepherdCare.Api.Models
{
    public class Area
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = "#6366f1";
        public string? BoundaryJson { get; set; }
        public List<Street> Streets { get; set; } = new();
    }

    public class Street
    {
        public Guid Id { get; set; }
        public Guid AreaId { get; set; }
        public Area? Area { get; set; }
        public string Name { get; set; } = string.Empty;
        public List<Building> Buildings { get; set; } = new();
    }

    public class Building
    {
        public Guid Id { get; set; }
        public Guid StreetId { get; set; }
        public Street? Street { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}
