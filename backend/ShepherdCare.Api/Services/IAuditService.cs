using ShepherdCare.Api.Models;
using System.Threading.Tasks;

namespace ShepherdCare.Api.Services
{
    public interface IAuditService
    {
        Task LogAsync(AuditLog log);
    }
}
