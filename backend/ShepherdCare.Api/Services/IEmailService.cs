namespace ShepherdCare.Api.Services
{
    public interface IEmailService
    {
        Task SendAsync(string to, string subject, string htmlBody);
        Task SendManyAsync(IEnumerable<string> recipients, string subject, string htmlBody);
        bool IsConfigured { get; }
    }
}
