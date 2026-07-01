using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Services;

namespace ShepherdCare.Api.Middleware
{
    public class TenantMiddleware
    {
        private readonly RequestDelegate _next;

        public TenantMiddleware(RequestDelegate next) => _next = next;

        public async Task InvokeAsync(HttpContext ctx, AppDbContext db, TenantContext tenant)
        {
            // Mobile sends X-Church-Slug header; web uses subdomain
            string? slug = ctx.Request.Headers["X-Church-Slug"].FirstOrDefault();

            if (string.IsNullOrWhiteSpace(slug))
            {
                // Extract from subdomain: stmark.sgch.al-hanna.com → "stmark"
                var host = ctx.Request.Host.Host;
                var parts = host.Split('.');
                if (parts.Length > 2)
                    slug = parts[0];
            }

            if (!string.IsNullOrWhiteSpace(slug) && slug != "www" && slug != "api")
            {
                var church = await db.Churches
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Slug == slug && c.IsActive);

                if (church != null)
                    tenant.SetChurch(church.Id);
            }

            await _next(ctx);
        }
    }
}
