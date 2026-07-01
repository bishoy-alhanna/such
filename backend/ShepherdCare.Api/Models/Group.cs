namespace ShepherdCare.Api.Models
{
    public class Group
    {
        public Guid Id { get; set; }
        public Guid ChurchId { get; set; }
        public string Name { get; set; } = string.Empty;
        public Guid? ServantUserId { get; set; }
        public User? ServantUser { get; set; }
        public List<Class> Classes { get; set; } = new();
    }
}
