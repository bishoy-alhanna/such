using System;
using Xunit;
using ShepherdCare.Api.DTOs;
using ShepherdCare.Api.Validators;

namespace ShepherdCare.Api.Tests.Validators
{
    public class AttendanceCreateDtoValidatorTests
    {
        private readonly AttendanceCreateDtoValidator _validator = new();

        [Fact]
        public void ValidAttendance_Passes()
        {
            var dto = new AttendanceCreateDto { MemberId = Guid.NewGuid(), Date = DateTime.UtcNow, AttendanceType = "SundaySchool", RecordedById = Guid.NewGuid() };
            var res = _validator.Validate(dto);
            Assert.True(res.IsValid);
        }

        [Fact]
        public void MissingMember_Fails()
        {
            var dto = new AttendanceCreateDto { Date = DateTime.UtcNow, AttendanceType = "SundaySchool", RecordedById = Guid.NewGuid() };
            var res = _validator.Validate(dto);
            Assert.False(res.IsValid);
            Assert.Contains(res.Errors, e => e.PropertyName == "MemberId");
        }
    }
}
