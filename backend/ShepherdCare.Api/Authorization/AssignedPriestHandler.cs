using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ShepherdCare.Api.Authorization
{
    public class AssignedPriestHandler : AuthorizationHandler<AssignedPriestRequirement, object>
    {
        private readonly AppDbContext _db;

        public AssignedPriestHandler(AppDbContext db)
        {
            _db = db;
        }

        protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, AssignedPriestRequirement requirement, object resource)
        {
            // Allow SeniorPriest and SuperAdmin by role
            var roleClaim = context.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
            if (roleClaim == "SeniorPriest" || roleClaim == "SuperAdmin")
            {
                context.Succeed(requirement);
                return;
            }

            // For Priests, check assigned priest on family
            if (roleClaim == "Priest")
            {
                Guid userId;
                var idClaim = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!Guid.TryParse(idClaim, out userId))
                {
                    context.Fail();
                    return;
                }

                // Resource can be a PriestNote or a Family or a Guid (note id). Handle common cases.
                Guid? familyId = null;

                if (resource is PriestNote note)
                {
                    familyId = note.FamilyId;
                }
                else if (resource is Family family)
                {
                    familyId = family.Id;
                }
                else if (resource is Guid noteId)
                {
                    var fetchedNote = await _db.PriestNotes.AsNoTracking().FirstOrDefaultAsync(p => p.Id == noteId);
                    familyId = fetchedNote?.FamilyId;
                }

                if (!familyId.HasValue)
                {
                    context.Fail();
                    return;
                }

                var fam = await _db.Families.AsNoTracking().FirstOrDefaultAsync(f => f.Id == familyId.Value);
                if (fam == null)
                {
                    context.Fail();
                    return;
                }

                if (fam.AssignedPriestId == userId)
                {
                    context.Succeed(requirement);
                }
                else
                {
                    context.Fail();
                }

                return;
            }

            context.Fail();
        }
    }
}
