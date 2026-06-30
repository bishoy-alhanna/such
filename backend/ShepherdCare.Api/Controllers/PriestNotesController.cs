using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;
using ShepherdCare.Api.Services;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PriestNotesController : ControllerBase
    {
    private readonly AppDbContext _db;
    private readonly IEncryptionService _enc;
    private readonly IAuditService _audit;
    private readonly Microsoft.AspNetCore.Authorization.IAuthorizationService _authorization;

        public PriestNotesController(AppDbContext db, IEncryptionService enc, IAuditService audit, Microsoft.AspNetCore.Authorization.IAuthorizationService authorization)
        {
            _db = db;
            _enc = enc;
            _audit = audit;
            _authorization = authorization;
        }

        [HttpPost]
        [Authorize(Roles = "Priest,SeniorPriest,SuperAdmin")]
        public async Task<IActionResult> Create(CreatePriestNoteDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Content))
                return BadRequest("Content is required.");

            // Only priests assigned to the family (or senior/admin roles) may create notes
            var userId = Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
            var userRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

            if (userRole == "Priest")
            {
                // must have FamilyId when priest creating
                if (!dto.FamilyId.HasValue) return BadRequest("FamilyId is required for priest-created notes.");
                var family = await _db.Families.FindAsync(dto.FamilyId.Value);
                if (family == null) return NotFound("Family not found.");
                if (family.AssignedPriestId != userId)
                    return Forbid();
            }

            var (cipher, iv) = _enc.Encrypt(dto.Content);
            var note = new PriestNote
            {
                FamilyId = dto.FamilyId,
                MemberId = dto.MemberId,
                EncryptedContent = cipher,
                Iv = iv,
                CreatedById = userId
            };
            _db.PriestNotes.Add(note);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "CreatePriestNote", PerformedBy = User.Identity?.Name ?? "system", Entity = "PriestNote", EntityId = note.Id.ToString(), Details = (note.FamilyId?.ToString() ?? note.MemberId?.ToString()) });

            return CreatedAtAction(nameof(GetById), new { id = note.Id }, new { id = note.Id });
        }

        [HttpGet("by-family/{familyId}")]
        [Authorize(Roles = "Priest,SeniorPriest,SuperAdmin")]
        public async Task<IActionResult> GetByFamily(Guid familyId)
        {
            var userId = Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
            var userRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

            var notes = await _db.PriestNotes
                .Where(n => n.FamilyId == familyId)
                .OrderByDescending(n => n.CreatedAt)
                .ToListAsync();

            // Priests only see their own notes; SeniorPriest/SuperAdmin see all
            if (userRole == "Priest")
                notes = notes.Where(n => n.CreatedById == userId).ToList();

            var result = notes.Select(n =>
            {
                string decrypted;
                try { decrypted = _enc.Decrypt(n.EncryptedContent, n.Iv ?? throw new InvalidOperationException("IV missing")); }
                catch { decrypted = "[decryption error]"; }
                return new { n.Id, content = decrypted, n.CreatedAt, n.CreatedById, n.UpdatedAt, n.UpdatedById };
            });

            return Ok(result);
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Priest,SeniorPriest,SuperAdmin")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var note = await _db.PriestNotes.Include(p => p.Family).FirstOrDefaultAsync(p => p.Id == id);
            if (note == null) return NotFound();
            // Use resource-based authorization
            var authResult = await _authorization.AuthorizeAsync(User, note, "CanAccessPriestNote");
            if (!authResult.Succeeded) return Forbid();

            // decrypt
            var decrypted = _enc.Decrypt(note.EncryptedContent, note.Iv ?? throw new InvalidOperationException("IV missing"));

            await _audit.LogAsync(new AuditLog { Action = "ViewPriestNote", PerformedBy = User.Identity?.Name ?? "system", Entity = "PriestNote", EntityId = note.Id.ToString(), Details = "viewed" });

            return Ok(new { id = note.Id, content = decrypted, note.CreatedAt, note.CreatedById, note.UpdatedAt, note.UpdatedById });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Priest,SeniorPriest,SuperAdmin")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var note = await _db.PriestNotes.Include(p => p.Family).FirstOrDefaultAsync(p => p.Id == id);
            if (note == null) return NotFound();

            var userId = Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
            var userRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;


            // Authorize deletion
            var deleteAuth = await _authorization.AuthorizeAsync(User, note, "CanAccessPriestNote");
            if (!deleteAuth.Succeeded) return Forbid();

            _db.PriestNotes.Remove(note);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "DeletePriestNote", PerformedBy = User.Identity?.Name ?? "system", Entity = "PriestNote", EntityId = note.Id.ToString(), Details = "deleted" });

            return NoContent();
        }
    }

    public class CreatePriestNoteDto
    {
        public Guid? FamilyId { get; set; }
        public Guid? MemberId { get; set; }
        public string Content { get; set; } = string.Empty;
    }
}
