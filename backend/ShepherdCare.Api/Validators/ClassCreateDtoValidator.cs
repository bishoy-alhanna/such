using FluentValidation;
using ShepherdCare.Api.DTOs;

namespace ShepherdCare.Api.Validators
{
    public class ClassCreateDtoValidator : AbstractValidator<ClassCreateDto>
    {
        public ClassCreateDtoValidator()
        {
            RuleFor(x => x.ClassName).NotEmpty().MaximumLength(200);
            RuleFor(x => x.ServiceId).NotEmpty();
        }
    }
}
