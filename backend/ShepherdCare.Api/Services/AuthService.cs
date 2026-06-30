using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Microsoft.IdentityModel.Tokens;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace ShepherdCare.Api.Services
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _db;
        private readonly string _jwtSecret;

        public AuthService(AppDbContext db, IConfiguration configuration)
        {
            _db = db;
            _jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET") ?? configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT secret not set");
        }

        public async Task<User?> ValidateUserAsync(string username, string password)
        {
            var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Username == username);
            if (user == null) return null;
            if (!user.IsActive) return null;
            if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash)) return null;
            return user;
        }

        public Task<string> GenerateJwtAsync(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_jwtSecret);
            var claimsList = new System.Collections.Generic.List<Claim> {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role?.Name ?? string.Empty)
            };
            if (user.FamilyMemberId.HasValue)
                claimsList.Add(new Claim("familyMemberId", user.FamilyMemberId.Value.ToString()));
            var claims = claimsList.ToArray();

            var creds = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature);
            var token = new JwtSecurityToken(claims: claims, expires: DateTime.UtcNow.AddHours(8), signingCredentials: creds);
            return Task.FromResult(tokenHandler.WriteToken(token));
        }

        public async Task<User> CreateUserAsync(string username, string password, Guid roleId, string? displayName = null)
        {
            var existing = await _db.Users.AnyAsync(u => u.Username == username);
            if (existing) throw new InvalidOperationException("Username already exists");

            var hash = BCrypt.Net.BCrypt.HashPassword(password);
            var user = new User { Username = username, PasswordHash = hash, RoleId = roleId, DisplayName = displayName };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            return user;
        }
    }
}
