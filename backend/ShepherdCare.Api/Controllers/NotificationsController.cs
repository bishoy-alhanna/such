using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;
using System.Security.Claims;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/notifications")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public NotificationsController(AppDbContext db)
        {
            _db = db;
        }

        private Guid? CallerId()
        {
            var v = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(v, out var id) ? id : null;
        }

        /// <summary>GET /api/notifications — paginated list for the current user</summary>
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var uid = CallerId();
            if (uid == null) return Unauthorized();

            var query = _db.Notifications.Where(n => n.UserId == uid.Value).OrderByDescending(n => n.CreatedAt);
            var total = await query.CountAsync();
            var items = await query
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(n => new { n.Id, n.Title, n.Body, n.Type, n.Link, n.IsRead, n.CreatedAt })
                .ToListAsync();

            return Ok(new { items, total, page, pageSize });
        }

        /// <summary>GET /api/notifications/unread-count</summary>
        [HttpGet("unread-count")]
        public async Task<IActionResult> UnreadCount()
        {
            var uid = CallerId();
            if (uid == null) return Unauthorized();
            var count = await _db.Notifications.CountAsync(n => n.UserId == uid.Value && !n.IsRead);
            return Ok(new { count });
        }

        /// <summary>POST /api/notifications/{id}/read — mark one as read</summary>
        [HttpPost("{id}/read")]
        public async Task<IActionResult> MarkRead(Guid id)
        {
            var uid = CallerId();
            if (uid == null) return Unauthorized();
            var n = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == uid.Value);
            if (n == null) return NotFound();
            n.IsRead = true;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>POST /api/notifications/read-all — mark all as read</summary>
        [HttpPost("read-all")]
        public async Task<IActionResult> MarkAllRead()
        {
            var uid = CallerId();
            if (uid == null) return Unauthorized();
            await _db.Notifications
                .Where(n => n.UserId == uid.Value && !n.IsRead)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
            return NoContent();
        }

        /// <summary>DELETE /api/notifications/{id}</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var uid = CallerId();
            if (uid == null) return Unauthorized();
            var n = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == uid.Value);
            if (n == null) return NotFound();
            _db.Notifications.Remove(n);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>DELETE /api/notifications — clear all for current user</summary>
        [HttpDelete]
        public async Task<IActionResult> DeleteAll()
        {
            var uid = CallerId();
            if (uid == null) return Unauthorized();
            await _db.Notifications.Where(n => n.UserId == uid.Value).ExecuteDeleteAsync();
            return NoContent();
        }

        /// <summary>POST /api/notifications/broadcast — send to a role group (admin/priest only)</summary>
        [HttpPost("broadcast")]
        [Authorize(Roles = "SuperAdmin,Priest,SeniorPriest,ServiceLeader")]
        public async Task<IActionResult> Broadcast([FromBody] BroadcastDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Body))
                return BadRequest("Title and Body are required.");

            var query = _db.Users.Include(u => u.Role).Where(u => u.IsActive);

            if (!string.IsNullOrEmpty(dto.Target) && dto.Target != "All")
                query = query.Where(u => u.Role != null && u.Role.Name == dto.Target);

            var users = await query.Select(u => u.Id).ToListAsync();

            var notifications = users.Select(uid => new Notification
            {
                UserId = uid,
                Title  = dto.Title.Trim(),
                Body   = dto.Body.Trim(),
                Type   = "Broadcast",
                Link   = dto.Link,
            }).ToList();

            _db.Notifications.AddRange(notifications);
            await _db.SaveChangesAsync();

            return Ok(new { sent = notifications.Count });
        }
    }

    public record BroadcastDto(string Title, string Body, string? Link, string? Target);
}
