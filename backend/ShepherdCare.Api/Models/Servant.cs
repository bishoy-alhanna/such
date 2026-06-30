using System;

namespace ShepherdCare.Api.Models
{
    public class Servant
    {
        public Guid Id { get; set; }
        public Guid ClassId { get; set; }
        public Class? Class { get; set; }
        public Guid UserId { get; set; }
    }
}
