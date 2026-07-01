using ShepherdCare.Api.Services;

namespace ShepherdCare.Api.Middleware
{
    public class SubscriptionMiddleware
    {
        private readonly RequestDelegate _next;

        public SubscriptionMiddleware(RequestDelegate next) => _next = next;

        public async Task InvokeAsync(HttpContext ctx, ITenantContext tenant, ISubscriptionService subs)
        {
            // Only enforce on mutating requests with a resolved tenant
            if (tenant.IsResolved && tenant.ChurchId.HasValue
                && ctx.Request.Method != HttpMethods.Get
                && ctx.Request.Method != HttpMethods.Options)
            {
                // Skip auth endpoints and church registration (needed to bootstrap)
                var path = ctx.Request.Path.Value ?? string.Empty;
                if (!path.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase)
                 && !path.StartsWith("/api/churches/register", StringComparison.OrdinalIgnoreCase))
                {
                    if (!await subs.IsWriteAllowedAsync(tenant.ChurchId.Value))
                    {
                        ctx.Response.StatusCode  = StatusCodes.Status403Forbidden;
                        ctx.Response.ContentType = "application/json";
                        await ctx.Response.WriteAsync(
                            "{\"message\":\"Your subscription has expired or been suspended. Contact support to restore access.\"}");
                        return;
                    }
                }
            }

            await _next(ctx);
        }
    }
}
