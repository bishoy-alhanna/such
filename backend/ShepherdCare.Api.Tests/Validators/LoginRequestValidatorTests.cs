using Xunit;
using ShepherdCare.Api.DTOs;
using ShepherdCare.Api.Validators;

namespace ShepherdCare.Api.Tests.Validators
{
    public class LoginRequestValidatorTests
    {
        private readonly LoginRequestValidator _validator = new();

        [Fact]
        public void ValidLogin_Passes()
        {
            var dto = new LoginRequest { Username = "admin", Password = "Admin123!" };
            var res = _validator.Validate(dto);
            Assert.True(res.IsValid);
        }

        [Fact]
        public void EmptyPassword_Fails()
        {
            var dto = new LoginRequest { Username = "admin", Password = "" };
            var res = _validator.Validate(dto);
            Assert.False(res.IsValid);
            Assert.Contains(res.Errors, e => e.PropertyName == "Password");
        }
    }
}
