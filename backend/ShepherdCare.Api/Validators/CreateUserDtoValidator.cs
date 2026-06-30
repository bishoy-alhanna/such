using FluentValidation;
using ShepherdCare.Api.DTOs;

namespace ShepherdCare.Api.Validators
{
    public class CreateUserDtoValidator : AbstractValidator<CreateUserDto>
    {
        public CreateUserDtoValidator()
        {
            RuleFor(x => x.Username).NotEmpty().MaximumLength(100);
            RuleFor(x => x.Password).NotEmpty().MinimumLength(8).WithMessage("Password must be at least 8 characters");
            RuleFor(x => x.RoleId).NotEmpty();
        }
    }
}
