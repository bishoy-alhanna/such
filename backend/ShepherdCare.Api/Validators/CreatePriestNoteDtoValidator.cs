using FluentValidation;
using ShepherdCare.Api.Controllers;

namespace ShepherdCare.Api.Validators
{
    public class CreatePriestNoteDtoValidator : AbstractValidator<CreatePriestNoteDto>
    {
        public CreatePriestNoteDtoValidator()
        {
            RuleFor(x => x.Content).NotEmpty().WithMessage("Content is required");
            RuleFor(x => x)
                .Must(x => x.FamilyId.HasValue || x.MemberId.HasValue)
                .WithMessage("Either FamilyId or MemberId must be provided");
        }
    }
}
