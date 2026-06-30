using Xunit;
using ShepherdCare.Api.DTOs;
using ShepherdCare.Api.Validators;

namespace ShepherdCare.Api.Tests.Validators
{
    public class FamilyCreateDtoValidatorTests
    {
        private readonly FamilyCreateDtoValidator _validator = new();

        [Fact]
        public void ValidFamily_Passes()
        {
            var dto = new FamilyCreateDto { FamilyName = "Smith", Address = "1 Church St" };
            var res = _validator.Validate(dto);
            Assert.True(res.IsValid);
        }

        [Fact]
        public void EmptyFamilyName_Fails()
        {
            var dto = new FamilyCreateDto { FamilyName = "" };
            var res = _validator.Validate(dto);
            Assert.False(res.IsValid);
            Assert.Contains(res.Errors, e => e.PropertyName == "FamilyName");
        }
    }
}
