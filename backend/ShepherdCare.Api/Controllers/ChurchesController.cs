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
    public class ChurchesController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ITenantContext _tenant;

        public ChurchesController(AppDbContext db, ITenantContext tenant)
        {
            _db = db;
            _tenant = tenant;
        }

        // ── Public: any client can look up a church by slug (for mobile setup screen) ──
        [AllowAnonymous]
        [HttpGet("slug/{slug}")]
        public async Task<IActionResult> GetBySlug(string slug)
        {
            var church = await _db.Churches
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Slug == slug && c.IsActive);

            return church is null ? NotFound() : Ok(ToDto(church));
        }

        // ── Public: self-registration by a new church ──
        [AllowAnonymous]
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterChurchRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Slug))
                return BadRequest("Name and Slug are required.");

            if (string.IsNullOrWhiteSpace(req.AdminUsername) || string.IsNullOrWhiteSpace(req.AdminPassword))
                return BadRequest("Admin username and password are required.");

            var slug = req.Slug.Trim().ToLower().Replace(" ", "-");

            if (await _db.Churches.AnyAsync(c => c.Slug == slug))
                return Conflict("A church with that slug already exists.");

            if (await _db.Users.IgnoreQueryFilters().AnyAsync(u => u.Username == req.AdminUsername.Trim()))
                return Conflict("That admin username is already taken.");

            var church = new Church
            {
                Id           = Guid.NewGuid(),
                Name         = req.Name.Trim(),
                Slug         = slug,
                IsActive     = false,
                ContactEmail = req.ContactEmail,
                City         = req.City,
                Country      = req.Country,
                CreatedAt    = DateTime.UtcNow
            };
            _db.Churches.Add(church);
            await _db.SaveChangesAsync();

            // Create the church's SuperAdmin — locked (PendingApproval) until the church is activated
            var superAdminRole = await _db.Roles.FirstAsync(r => r.Name == "SuperAdmin");
            _db.Users.Add(new User
            {
                Username        = req.AdminUsername.Trim(),
                PasswordHash    = BCrypt.Net.BCrypt.HashPassword(req.AdminPassword),
                RoleId          = superAdminRole.Id,
                DisplayName     = req.AdminDisplayName?.Trim() ?? req.AdminUsername.Trim(),
                ChurchId        = church.Id,
                PendingApproval = true,
                CreatedAt       = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();

            return CreatedAtAction(nameof(GetBySlug), new { slug = church.Slug }, ToDto(church));
        }

        // ── SystemAdmin only: list all churches ──
        [Authorize(Roles = "SystemAdmin")]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var churches = await _db.Churches
                .AsNoTracking()
                .OrderBy(c => c.Name)
                .ToListAsync();

            // Fetch pending admin username for each church
            var churchIds = churches.Select(c => c.Id).ToList();
            var admins = await _db.Users
                .IgnoreQueryFilters()
                .Where(u => u.ChurchId != null && churchIds.Contains(u.ChurchId!.Value) && u.PendingApproval)
                .Select(u => new { u.ChurchId, u.Username })
                .ToListAsync();

            var adminMap = admins.ToDictionary(a => a.ChurchId!.Value, a => a.Username);

            return Ok(churches.Select(c => ToDto(c, adminMap.GetValueOrDefault(c.Id))));
        }

        // ── SystemAdmin only: activate / update a church ──
        [Authorize(Roles = "SystemAdmin")]
        [HttpPatch("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateChurchRequest req)
        {
            var church = await _db.Churches.FindAsync(id);
            if (church is null) return NotFound();

            var activating = req.IsActive == true && !church.IsActive;

            if (req.Name         is not null) church.Name         = req.Name;
            if (req.IsActive     is not null) church.IsActive     = req.IsActive.Value;
            if (req.LogoUrl      is not null) church.LogoUrl      = req.LogoUrl;
            if (req.ContactEmail is not null) church.ContactEmail = req.ContactEmail;
            if (req.City         is not null) church.City         = req.City;
            if (req.Country      is not null) church.Country      = req.Country;

            // When a church is approved, unlock its pending SuperAdmin
            if (activating)
            {
                var pendingAdmin = await _db.Users
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(u => u.ChurchId == id && u.PendingApproval);
                if (pendingAdmin is not null)
                    pendingAdmin.PendingApproval = false;
            }

            await _db.SaveChangesAsync();
            return Ok(ToDto(church));
        }

        private async Task<User?> FindChurchSuperAdmin(Guid churchId)
        {
            var roleId = await _db.Roles
                .Where(r => r.Name == "SuperAdmin")
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            return await _db.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.ChurchId == churchId && u.RoleId == roleId);
        }

        // ── SystemAdmin only: get the church's admin user info ──
        [Authorize(Roles = "SystemAdmin")]
        [HttpGet("{id:guid}/admin")]
        public async Task<IActionResult> GetAdmin(Guid id)
        {
            var admin = await FindChurchSuperAdmin(id);
            if (admin is null) return NotFound("No SuperAdmin found for this church.");
            return Ok(new ChurchAdminDto(admin.Id, admin.Username, admin.DisplayName, admin.IsActive, admin.PendingApproval));
        }

        // ── SystemAdmin only: activate or deactivate a church's admin user ──
        [Authorize(Roles = "SystemAdmin")]
        [HttpPatch("{id:guid}/admin/status")]
        public async Task<IActionResult> SetAdminStatus(Guid id, [FromBody] UpdateAdminStatusRequest req)
        {
            var admin = await FindChurchSuperAdmin(id);
            if (admin is null) return NotFound("No SuperAdmin found for this church.");

            admin.IsActive = req.IsActive;
            await _db.SaveChangesAsync();

            return Ok(new ChurchAdminDto(admin.Id, admin.Username, admin.DisplayName, admin.IsActive, admin.PendingApproval));
        }

        // ── SystemAdmin only: reset a church admin's password ──
        [Authorize(Roles = "SystemAdmin")]
        [HttpPost("{id:guid}/admin/reset-password")]
        public async Task<IActionResult> ResetAdminPassword(Guid id, [FromBody] ResetAdminPasswordRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 8)
                return BadRequest("Password must be at least 8 characters.");

            var admin = await FindChurchSuperAdmin(id);
            if (admin is null) return NotFound("No SuperAdmin found for this church.");

            admin.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Password updated successfully.", username = admin.Username });
        }

        private static ChurchDto ToDto(Church c, string? adminUsername = null) => new(
            c.Id, c.Name, c.Slug, c.IsActive,
            c.LogoUrl, c.ContactEmail, c.City, c.Country, c.CreatedAt, adminUsername);
    }
}
