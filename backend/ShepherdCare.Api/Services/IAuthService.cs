using ShepherdCare.Api.Models;
using System.Threading.Tasks;

namespace ShepherdCare.Api.Services
{
    public interface IAuthService
    {
        Task<User?> ValidateUserAsync(string username, string password);
        Task<string> GenerateJwtAsync(User user);
        Task<User> CreateUserAsync(string username, string password, System.Guid roleId, string? displayName = null);
    }
}
