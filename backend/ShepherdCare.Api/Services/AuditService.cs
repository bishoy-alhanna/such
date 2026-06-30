using System.Threading.Tasks;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;

namespace ShepherdCare.Api.Services
{
    public class AuditService : IAuditService
    {
        private readonly AppDbContext _db;

        public AuditService(AppDbContext db)
        {
            _db = db;
        }

        public async Task LogAsync(AuditLog log)
        {
            // Ensure required fields are non-null to avoid DB constraint errors.
            log.Action ??= string.Empty;
            log.PerformedBy ??= string.Empty;
            log.Entity ??= string.Empty;
            log.EntityId ??= string.Empty;
            log.Details ??= string.Empty;

            _db.AuditLogs.Add(log);
            await _db.SaveChangesAsync();
        }
    }
}
