using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;
using System.Security.Claims;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Authorize]
    public class FollowUpTasksController : ControllerBase
    {
        private static readonly string[] ValidStatuses = ["Open", "Done", "Cancelled"];

        private readonly AppDbContext _db;
        public FollowUpTasksController(AppDbContext db) => _db = db;

        private Guid? CallerId() =>
            Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
        private string CallerRole() => User.FindFirstValue(ClaimTypes.Role) ?? "";

        // ── GET /api/tasks?status=Open&assignedToMe=true ───────────────────────

        [HttpGet("api/tasks")]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? status,
            [FromQuery] bool    assignedToMe = false,
            [FromQuery] Guid?   memberId     = null)
        {
            var callerId = CallerId();
            var role     = CallerRole();

            var query = _db.FollowUpTasks.AsQueryable();

            // Non-admins only see tasks assigned to them
            if (role is not ("SuperAdmin" or "ServiceLeader" or "Priest" or "SeniorPriest"))
                query = query.Where(t => t.AssignedToUserId == callerId);
            else if (assignedToMe && callerId.HasValue)
                query = query.Where(t => t.AssignedToUserId == callerId);

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(t => t.Status == status);

            if (memberId.HasValue)
                query = query.Where(t => t.RelatedMemberId == memberId);

            var items = await query
                .OrderBy(t => t.DueDate == null).ThenBy(t => t.DueDate).ThenByDescending(t => t.CreatedAt)
                .Select(t => new
                {
                    t.Id, t.Title, t.Notes, t.DueDate, t.Status,
                    t.AssignedToUserId,
                    AssignedToName = t.AssignedToUser != null
                        ? t.AssignedToUser.DisplayName ?? t.AssignedToUser.Username : null,
                    t.RelatedMemberId,
                    RelatedMemberName = t.RelatedMember != null ? t.RelatedMember.FullName : null,
                    t.RelatedVisitId,
                    t.CreatedAt, t.CompletedAt,
                    IsOverdue = t.Status == "Open" && t.DueDate.HasValue && t.DueDate.Value < DateTime.UtcNow,
                })
                .ToListAsync();

            return Ok(items);
        }

        // ── POST /api/tasks ────────────────────────────────────────────────────

        [HttpPost("api/tasks")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest,Servant,DataEntry")]
        public async Task<IActionResult> Create([FromBody] TaskCreateDto dto)
        {
            var callerId = CallerId();
            if (callerId == null) return Unauthorized();

            if (string.IsNullOrWhiteSpace(dto.Title))
                return BadRequest(new { message = "العنوان مطلوب." });

            var task = new FollowUpTask
            {
                Title            = dto.Title.Trim(),
                Notes            = dto.Notes?.Trim(),
                DueDate          = dto.DueDate,
                AssignedToUserId = dto.AssignedToUserId != Guid.Empty ? dto.AssignedToUserId : callerId.Value,
                RelatedMemberId  = dto.RelatedMemberId,
                RelatedVisitId   = dto.RelatedVisitId,
                CreatedById      = callerId.Value,
            };
            _db.FollowUpTasks.Add(task);
            await _db.SaveChangesAsync();
            return Ok(new { task.Id, task.Title, task.Status });
        }

        // ── PUT /api/tasks/{id} ────────────────────────────────────────────────

        [HttpPut("api/tasks/{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] TaskUpdateDto dto)
        {
            var callerId = CallerId();
            var role     = CallerRole();
            var task     = await _db.FollowUpTasks.FindAsync(id);
            if (task == null) return NotFound();

            // Only the assignee or admin can edit
            if (task.AssignedToUserId != callerId
             && role is not ("SuperAdmin" or "ServiceLeader" or "Priest" or "SeniorPriest"))
                return Forbid();

            if (!ValidStatuses.Contains(dto.Status))
                return BadRequest(new { message = "الحالة غير صالحة." });

            task.Title   = dto.Title?.Trim() ?? task.Title;
            task.Notes   = dto.Notes?.Trim();
            task.DueDate = dto.DueDate;

            if (task.Status != dto.Status)
            {
                task.Status      = dto.Status;
                task.CompletedAt = dto.Status == "Done" ? DateTime.UtcNow : null;
            }

            await _db.SaveChangesAsync();
            return Ok(new { task.Id, task.Status });
        }

        // ── DELETE /api/tasks/{id} ─────────────────────────────────────────────

        [HttpDelete("api/tasks/{id}")]
        [Authorize(Roles = "SuperAdmin,ServiceLeader,Priest,SeniorPriest")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var task = await _db.FollowUpTasks.FindAsync(id);
            if (task == null) return NotFound();
            _db.FollowUpTasks.Remove(task);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── GET /api/tasks/overdue-count ───────────────────────────────────────

        [HttpGet("api/tasks/overdue-count")]
        public async Task<IActionResult> OverdueCount()
        {
            var callerId = CallerId();
            var role     = CallerRole();
            var now      = DateTime.UtcNow;

            var query = _db.FollowUpTasks
                .Where(t => t.Status == "Open" && t.DueDate.HasValue && t.DueDate.Value < now);

            if (role is not ("SuperAdmin" or "ServiceLeader" or "Priest" or "SeniorPriest"))
                query = query.Where(t => t.AssignedToUserId == callerId);

            var count = await query.CountAsync();
            return Ok(new { count });
        }
    }

    public class TaskCreateDto
    {
        public string    Title            { get; set; } = string.Empty;
        public string?   Notes            { get; set; }
        public DateTime? DueDate          { get; set; }
        public Guid      AssignedToUserId { get; set; }
        public Guid?     RelatedMemberId  { get; set; }
        public Guid?     RelatedVisitId   { get; set; }
    }

    public class TaskUpdateDto
    {
        public string?   Title   { get; set; }
        public string?   Notes   { get; set; }
        public DateTime? DueDate { get; set; }
        public string    Status  { get; set; } = "Open";
    }
}
