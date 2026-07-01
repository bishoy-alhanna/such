namespace ShepherdCare.Api.Services
{
    public interface ITenantContext
    {
        Guid? ChurchId { get; }
        bool IsResolved { get; }
    }

    public class TenantContext : ITenantContext
    {
        public Guid? ChurchId { get; private set; }
        public bool IsResolved { get; private set; }

        public void SetChurch(Guid churchId)
        {
            ChurchId = churchId;
            IsResolved = true;
        }
    }
}
