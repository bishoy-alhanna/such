using FluentValidation;
using ShepherdCare.Api.DTOs;

namespace ShepherdCare.Api.Validators
{
    public class VisitCreateDtoValidator : AbstractValidator<VisitCreateDto>
    {
        public VisitCreateDtoValidator()
        {
            RuleFor(x => x.FamilyId).NotEmpty();
            RuleFor(x => x.PerformedById).NotEmpty();
            RuleFor(x => x.VisitDate).NotEmpty();
        }
    }
}
