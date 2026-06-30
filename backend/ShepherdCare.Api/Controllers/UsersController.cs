using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.DTOs;
using ShepherdCare.Api.Models;
using ShepherdCare.Api.Services;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "SuperAdmin")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IAuthService _auth;
        private readonly IAuditService _audit;

        public UsersController(AppDbContext db, IAuthService auth, IAuditService audit)
        {
            _db = db;
            _auth = auth;
            _audit = audit;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var query = _db.Users.AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(u => u.Username.Contains(q) || (u.DisplayName != null && u.DisplayName.Contains(q)));

            var total = await query.CountAsync();
            var items = await query
                .OrderBy(u => u.Username)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new UserDto { Id = u.Id, Username = u.Username, DisplayName = u.DisplayName, RoleId = u.RoleId, Email = u.Email })
                .ToListAsync();

            return Ok(new DTOs.PagedResponse<UserDto> { Items = items, Page = page, PageSize = pageSize, TotalCount = total });
        }

        // Lightweight endpoint: any authenticated user can get id+name list for servant dropdowns
        [HttpGet("servant-options")]
        [Authorize]
        public async Task<IActionResult> GetServantOptions()
        {
            var items = await _db.Users
                .OrderBy(u => u.DisplayName ?? u.Username)
                .Select(u => new { u.Id, Name = u.DisplayName ?? u.Username })
                .ToListAsync();
            return Ok(items);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, CreateUserDto dto)
        {
            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();
            user.DisplayName = dto.DisplayName;
            user.RoleId = dto.RoleId;
            user.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim().ToLower();
            if (!string.IsNullOrWhiteSpace(dto.Password))
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "UpdateUser", PerformedBy = User.Identity?.Name ?? "system", Entity = "User", EntityId = user.Id.ToString(), Details = user.Username });
            return NoContent();
        }

        [HttpPost]
        public async Task<IActionResult> Create(CreateUserDto dto)
        {
            var user = await _auth.CreateUserAsync(dto.Username, dto.Password, dto.RoleId, dto.DisplayName);
            if (!string.IsNullOrWhiteSpace(dto.Email))
            {
                user.Email = dto.Email.Trim().ToLower();
                await _db.SaveChangesAsync();
            }
            await _audit.LogAsync(new AuditLog { Action = "CreateUser", PerformedBy = User.Identity?.Name ?? "system", Entity = "User", EntityId = user.Id.ToString(), Details = user.Username });
            return CreatedAtAction(nameof(GetAll), new { id = user.Id }, new UserDto { Id = user.Id, Username = user.Username, DisplayName = user.DisplayName, RoleId = user.RoleId, Email = user.Email });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();
            _db.Users.Remove(user);
            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "DeleteUser", PerformedBy = User.Identity?.Name ?? "system", Entity = "User", EntityId = id.ToString(), Details = user.Username });
            return NoContent();
        }

        [HttpGet("pending")]
        public async Task<IActionResult> GetPending()
        {
            var items = await _db.Users
                .Where(u => u.PendingApproval)
                .Include(u => u.Role)
                .OrderBy(u => u.CreatedAt)
                .Select(u => new {
                    u.Id, u.Username, u.DisplayName, u.CreatedAt, u.FamilyMemberId,
                    RoleName = u.Role != null ? u.Role.Name : null
                })
                .ToListAsync();
            return Ok(items);
        }

        [HttpPost("{id}/approve")]
        public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveUserDto dto)
        {
            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();
            if (!user.PendingApproval) return BadRequest(new { message = "User is not pending approval." });

            var role = await _db.Roles.FindAsync(dto.RoleId);
            if (role == null) return BadRequest(new { message = "Invalid role." });

            user.RoleId = dto.RoleId;
            user.IsActive = true;
            user.PendingApproval = false;
            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "ApproveUser", PerformedBy = User.Identity?.Name ?? "system", Entity = "User", EntityId = user.Id.ToString(), Details = $"{user.Username} → {role.Name}" });
            return NoContent();
        }

        [HttpDelete("{id}/reject")]
        public async Task<IActionResult> Reject(Guid id)
        {
            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();
            if (!user.PendingApproval) return BadRequest(new { message = "User is not pending approval." });

            _db.Users.Remove(user);
            await _db.SaveChangesAsync();
            await _audit.LogAsync(new AuditLog { Action = "RejectUser", PerformedBy = User.Identity?.Name ?? "system", Entity = "User", EntityId = id.ToString(), Details = user.Username });
            return NoContent();
        }
    }
}
