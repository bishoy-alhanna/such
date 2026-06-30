using System.Collections.Concurrent;
using System.Net;

namespace ShepherdCare.Api.Middleware
{
    public class RateLimitMiddleware
    {
        private readonly RequestDelegate _next;
        private static readonly ConcurrentDictionary<string, (int Count, DateTime WindowStart)> _stores = new();
        private readonly int _limit;
        private readonly TimeSpan _window;

        public RateLimitMiddleware(RequestDelegate next, int limit = 10, TimeSpan? window = null)
        {
            _next = next;
            _limit = limit;
            _window = window ?? TimeSpan.FromMinutes(1);
        }

        public async Task InvokeAsync(HttpContext context)
        {
            if (context.Request.Path.StartsWithSegments("/api/auth/login", StringComparison.OrdinalIgnoreCase))
            {
                var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                var now = DateTime.UtcNow;
                var entry = _stores.GetOrAdd(ip, _ => (0, now));
                if (now - entry.WindowStart > _window)
                {
                    entry = (0, now);
                }
                entry.Count++;
                _stores[ip] = entry;
                if (entry.Count > _limit)
                {
                    context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
                    await context.Response.WriteAsync("Too many requests");
                    return;
                }
            }

            await _next(context);
        }
    }

    public static class RateLimitMiddlewareExtensions
    {
        public static IApplicationBuilder UseSimpleRateLimit(this IApplicationBuilder builder, int limit = 10, TimeSpan? window = null)
        {
            return builder.UseMiddleware<RateLimitMiddleware>(limit, window);
        }
    }
}
