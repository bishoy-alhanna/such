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
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _auth;
        private readonly IAuditService _audit;
        private readonly AppDbContext _db;

        public AuthController(IAuthService auth, IAuditService audit, AppDbContext db)
        {
            _auth = auth;
            _audit = audit;
            _db = db;
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login(LoginRequest req)
        {
            // Check pending/disabled state before password check for specific error messages
            var existing = await _db.Users
                .IgnoreQueryFilters()
                .Where(u => u.Username == req.Username)
                .Select(u => new { u.PendingApproval, u.IsActive, u.ChurchId, u.PasswordHash })
                .FirstOrDefaultAsync();

            if (existing != null)
            {
                if (existing.PendingApproval)
                {
                    await _audit.LogAsync(new AuditLog { Action = "LoginFailed", PerformedBy = req.Username, Entity = "User", EntityId = "", Details = "Account pending approval" });
                    return Unauthorized(new { message = "Account pending admin approval" });
                }
                if (!existing.IsActive)
                {
                    await _audit.LogAsync(new AuditLog { Action = "LoginFailed", PerformedBy = req.Username, Entity = "User", EntityId = "", Details = "Account disabled" });
                    return Unauthorized(new { message = "Account is disabled" });
                }

                // Check church-level access (skip for SystemAdmin who has no church)
                if (existing.ChurchId.HasValue)
                {
                    var church = await _db.Churches
                        .Where(c => c.Id == existing.ChurchId.Value)
                        .Select(c => new { c.IsActive })
                        .FirstOrDefaultAsync();

                    if (church != null && !church.IsActive)
                    {
                        await _audit.LogAsync(new AuditLog { Action = "LoginFailed", PerformedBy = req.Username, Entity = "User", EntityId = "", Details = "Church deactivated" });
                        return Unauthorized(new { message = "Your church account has been deactivated. Please contact the church administrator for more information." });
                    }

                    var sub = await _db.Subscriptions
                        .IgnoreQueryFilters()
                        .Where(s => s.ChurchId == existing.ChurchId.Value)
                        .Select(s => new { s.Status, s.TrialEndsAt })
                        .FirstOrDefaultAsync();

                    if (sub != null)
                    {
                        bool trialExpired = sub.Status == Models.SubscriptionStatus.Trial
                                         && sub.TrialEndsAt < DateTime.UtcNow;
                        bool suspended    = sub.Status == Models.SubscriptionStatus.Suspended;

                        if (trialExpired || suspended)
                        {
                            await _audit.LogAsync(new AuditLog { Action = "LoginFailed", PerformedBy = req.Username, Entity = "User", EntityId = "", Details = "Subscription suspended/expired" });
                            return Unauthorized(new { message = "Your church subscription has been suspended. Please contact the church administrator for more information." });
                        }
                    }
                }
            }

            var user = await _auth.ValidateUserAsync(req.Username, req.Password);
            if (user == null)
            {
                await _audit.LogAsync(new AuditLog { Action = "LoginFailed", PerformedBy = req.Username, Entity = "User", EntityId = "", Details = "Invalid credentials" });
                return Unauthorized(new { message = "Invalid credentials" });
            }

            var token = await _auth.GenerateJwtAsync(user);
            await _audit.LogAsync(new AuditLog { Action = "LoginSuccess", PerformedBy = user.Username, Entity = "User", EntityId = user.Id.ToString(), Details = "User logged in" });

            string? churchSlug = null;
            if (user.ChurchId.HasValue)
            {
                churchSlug = await _db.Churches
                    .Where(c => c.Id == user.ChurchId.Value)
                    .Select(c => c.Slug)
                    .FirstOrDefaultAsync();
            }

            return Ok(new {
                token,
                user = new {
                    id          = user.Id,
                    username    = user.Username,
                    displayName = user.DisplayName,
                    role        = user.Role?.Name ?? string.Empty,
                    churchSlug,
                }
            });
        }

        /// <summary>Check whether a National ID belongs to an existing member (no auth required).</summary>
        [HttpGet("check-national-id")]
        [AllowAnonymous]
        public async Task<IActionResult> CheckNationalId([FromQuery] string nationalId)
        {
            if (string.IsNullOrWhiteSpace(nationalId) || nationalId.Length != 14)
                return BadRequest(new { message = "National ID must be 14 digits." });

            var member = await _db.FamilyMembers
                .Where(m => m.NationalId == nationalId)
                .Select(m => new { m.Id, m.FullName })
                .FirstOrDefaultAsync();

            if (member == null)
                return Ok(new NationalIdCheckResult { Found = false });

            var alreadyLinked = await _db.Users.AnyAsync(u => u.FamilyMemberId == member.Id);
            return Ok(new NationalIdCheckResult { Found = true, MemberName = member.FullName, AlreadyRegistered = alreadyLinked });
        }

        [HttpPost("signup")]
        [AllowAnonymous]
        public async Task<IActionResult> Signup(SignupDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username))   return BadRequest(new { message = "Username is required." });
            if (string.IsNullOrWhiteSpace(dto.Password))   return BadRequest(new { message = "Password is required." });
            if (string.IsNullOrWhiteSpace(dto.NationalId) || dto.NationalId.Length != 14)
                return BadRequest(new { message = "National ID must be 14 digits." });

            if (await _db.Users.AnyAsync(u => u.Username == dto.Username))
                return BadRequest(new { message = "Username already taken." });

            // Signup always creates a pending Member; admin assigns the final role on approval
            var assignedRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Member");
            if (assignedRole == null) return StatusCode(500, new { message = "Member role not configured." });

            Guid familyMemberId;
            string? displayName;

            var existingMember = await _db.FamilyMembers.FirstOrDefaultAsync(m => m.NationalId == dto.NationalId);

            if (existingMember != null)
            {
                if (await _db.Users.AnyAsync(u => u.FamilyMemberId == existingMember.Id))
                    return BadRequest(new { message = "This National ID is already registered." });
                familyMemberId = existingMember.Id;
                displayName = dto.FullName ?? existingMember.FullName;
            }
            else
            {
                if (string.IsNullOrWhiteSpace(dto.FullName))
                    return BadRequest(new { message = "Full name is required for new member registration." });

                displayName = dto.FullName;
                bool isMarriedFemale = dto.Gender == "Female" && dto.IsMarried;

                if (isMarriedFemale && !string.IsNullOrWhiteSpace(dto.HusbandNationalId))
                {
                    // ── Married female: primary record in the couple's OWN household ────────
                    // The husband may only be recorded as "ابن" in his father's family.
                    // We must NOT use that family — find/create a household where he is the head.
                    var husband = await _db.FamilyMembers
                        .FirstOrDefaultAsync(m => m.NationalId == dto.HusbandNationalId);

                    Guid couplesFamilyId;

                    if (husband != null)
                    {
                        // Always create a new household for the couple.
                        // We must NOT reuse husband.FamilyId — that is his father's family
                        // where he is recorded as "ابن". A relation-based check is unreliable
                        // because Relation can be null, which would still match a father's family.
                        var couplesFamily = new Family { FamilyName = husband.FullName };
                        _db.Families.Add(couplesFamily);
                        await _db.SaveChangesAsync();
                        couplesFamilyId = couplesFamily.Id;

                        // Add husband as head of the new household
                        _db.FamilyMembers.Add(new FamilyMember
                        {
                            FamilyId = couplesFamilyId,
                            FullName = husband.FullName,
                            NationalId = husband.NationalId,
                            Gender = "Male",
                            DateOfBirth = husband.DateOfBirth,
                            Mobile = husband.Mobile,
                            Relation = "رب الأسرة",
                        });
                        await _db.SaveChangesAsync();

                        // Link the new couple's household back to husband's original (father's) family
                        bool linkExists1 = await _db.FamilyLinks.AnyAsync(l =>
                            l.FamilyId == husband.FamilyId && l.LinkedFamilyId == couplesFamilyId);
                        if (!linkExists1)
                        {
                            _db.FamilyLinks.Add(new FamilyLink
                            {
                                FamilyId = husband.FamilyId,
                                LinkedFamilyId = couplesFamilyId,
                                RelationLabel = $"عائلة {husband.FullName} (ابن)",
                            });
                            await _db.SaveChangesAsync();
                        }
                    }
                    else
                    {
                        // Husband not in system — create a new household
                        var couplesFamily = new Family { FamilyName = dto.FullName };
                        _db.Families.Add(couplesFamily);
                        await _db.SaveChangesAsync();
                        couplesFamilyId = couplesFamily.Id;
                    }

                    var wifeRecord = new FamilyMember
                    {
                        FamilyId = couplesFamilyId,
                        FullName = dto.FullName,
                        NationalId = dto.NationalId,
                        Gender = "Female",
                        DateOfBirth = dto.DateOfBirth,
                        Mobile = dto.Mobile,
                        Relation = "زوجة",
                    };
                    _db.FamilyMembers.Add(wifeRecord);
                    await _db.SaveChangesAsync();
                    familyMemberId = wifeRecord.Id;

                    // Also add her to father's family as daughter + link the two families
                    if (!string.IsNullOrWhiteSpace(dto.FatherNationalId))
                    {
                        var father = await _db.FamilyMembers.FirstOrDefaultAsync(m => m.NationalId == dto.FatherNationalId);
                        if (father != null)
                        {
                            var daughterRecord = new FamilyMember
                            {
                                FamilyId = father.FamilyId,
                                FullName = dto.FullName,
                                NationalId = dto.NationalId,
                                Gender = "Female",
                                DateOfBirth = dto.DateOfBirth,
                                Mobile = dto.Mobile,
                                Relation = "ابنة",
                            };
                            _db.FamilyMembers.Add(daughterRecord);

                            // One link from wife's father's family to the couple's family,
                            // labelled with wife's name + husband's family name.
                            bool linkExists2 = await _db.FamilyLinks.AnyAsync(l =>
                                l.FamilyId == father.FamilyId && l.LinkedFamilyId == couplesFamilyId);
                            if (!linkExists2)
                            {
                                var couplesName = husband != null ? husband.FullName : dto.FullName;
                                _db.FamilyLinks.Add(new FamilyLink
                                {
                                    FamilyId = father.FamilyId,
                                    LinkedFamilyId = couplesFamilyId,
                                    RelationLabel = $"{dto.FullName} - عائلة {couplesName}",
                                });
                                await _db.SaveChangesAsync();
                            }
                        }
                    }
                }
                else
                {
                    // ── Single or male: find or create family via father's National ID ───────
                    Guid familyId;
                    if (!string.IsNullOrWhiteSpace(dto.FatherNationalId))
                    {
                        var father = await _db.FamilyMembers.FirstOrDefaultAsync(m => m.NationalId == dto.FatherNationalId);
                        if (father != null)
                        {
                            familyId = father.FamilyId;
                        }
                        else
                        {
                            var newFamily = new Family { FamilyName = dto.FullName };
                            _db.Families.Add(newFamily);
                            await _db.SaveChangesAsync();
                            familyId = newFamily.Id;
                        }
                    }
                    else
                    {
                        var newFamily = new Family { FamilyName = dto.FullName };
                        _db.Families.Add(newFamily);
                        await _db.SaveChangesAsync();
                        familyId = newFamily.Id;
                    }

                    var newMember = new FamilyMember
                    {
                        FamilyId = familyId,
                        FullName = dto.FullName,
                        NationalId = dto.NationalId,
                        Gender = dto.Gender,
                        DateOfBirth = dto.DateOfBirth,
                        Mobile = dto.Mobile,
                        Relation = dto.Gender == "Female" ? "ابنة" : "ابن",
                    };
                    _db.FamilyMembers.Add(newMember);
                    await _db.SaveChangesAsync();
                    familyMemberId = newMember.Id;
                }
            }

            var hash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            var user = new User
            {
                Username = dto.Username,
                PasswordHash = hash,
                RoleId = assignedRole.Id,
                DisplayName = displayName,
                IsActive = false,
                PendingApproval = true,
                FamilyMemberId = familyMemberId,
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "Signup", PerformedBy = dto.Username, Entity = "User", EntityId = user.Id.ToString(), Details = $"Self-registration, NationalId={dto.NationalId}" });
            return Ok(new { message = "Registration submitted. Waiting for admin approval." });
        }
    }
}
