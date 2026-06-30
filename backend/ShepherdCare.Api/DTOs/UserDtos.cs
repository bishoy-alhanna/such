using System;

namespace ShepherdCare.Api.DTOs
{
    public class CreateUserDto
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public Guid RoleId { get; set; }
        public string? DisplayName { get; set; }
        public string? Email { get; set; }
    }

    public class UserDto
    {
        public Guid Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
        public Guid RoleId { get; set; }
        public string? Email { get; set; }
    }
}
