using System;

namespace ShepherdCare.Api.Models
{
    public class Church
    {
        public Guid   Id        { get; set; }
        public string Name      { get; set; } = string.Empty;
        public string Slug      { get; set; } = string.Empty; // used in subdomain + X-Church-Slug header
        public bool   IsActive  { get; set; } = false;        // false until SystemAdmin approves
        public string? LogoUrl  { get; set; }
        public string? ContactEmail { get; set; }
        public string? City     { get; set; }
        public string? Country  { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
