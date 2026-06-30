using FluentValidation;
using ShepherdCare.Api.DTOs;

namespace ShepherdCare.Api.Validators
{
    public class ServiceCreateDtoValidator : AbstractValidator<ServiceCreateDto>
    {
        public ServiceCreateDtoValidator()
        {
            RuleFor(x => x.ServiceName).NotEmpty().MaximumLength(200);
        }
    }
}
