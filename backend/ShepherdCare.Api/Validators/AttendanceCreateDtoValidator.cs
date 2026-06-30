using FluentValidation;
using ShepherdCare.Api.DTOs;

namespace ShepherdCare.Api.Validators
{
    public class AttendanceCreateDtoValidator : AbstractValidator<AttendanceCreateDto>
    {
        public AttendanceCreateDtoValidator()
        {
            RuleFor(x => x.MemberId).NotEmpty();
            RuleFor(x => x.Date).NotEmpty();
            RuleFor(x => x.AttendanceType).NotEmpty().MaximumLength(100);
            RuleFor(x => x.RecordedById).NotEmpty();
            RuleFor(x => x.Notes).MaximumLength(500);
        }
    }
}
