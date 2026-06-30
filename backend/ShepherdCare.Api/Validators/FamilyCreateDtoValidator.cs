using FluentValidation;
using ShepherdCare.Api.DTOs;

namespace ShepherdCare.Api.Validators
{
    public class FamilyCreateDtoValidator : AbstractValidator<FamilyCreateDto>
    {
        public FamilyCreateDtoValidator()
        {
            RuleFor(x => x.FamilyName).NotEmpty().WithMessage("FamilyName is required").MaximumLength(200);
            RuleFor(x => x.PhoneNumbers).MaximumLength(200);
            RuleFor(x => x.Address).MaximumLength(500);
        }
    }
}
