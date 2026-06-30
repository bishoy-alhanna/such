using System.Net;
using System.Net.Mail;

namespace ShepherdCare.Api.Services
{
    public class SmtpEmailService : IEmailService
    {
        private readonly string? _host;
        private readonly int    _port;
        private readonly string? _user;
        private readonly string? _pass;
        private readonly string? _from;
        private readonly bool   _tls;
        private readonly ILogger<SmtpEmailService> _log;

        public bool IsConfigured => !string.IsNullOrWhiteSpace(_host) && !string.IsNullOrWhiteSpace(_from);

        public SmtpEmailService(ILogger<SmtpEmailService> log)
        {
            _log  = log;
            _host = Environment.GetEnvironmentVariable("SMTP_HOST");
            _port = int.TryParse(Environment.GetEnvironmentVariable("SMTP_PORT"), out var p) ? p : 587;
            _user = Environment.GetEnvironmentVariable("SMTP_USER");
            _pass = Environment.GetEnvironmentVariable("SMTP_PASS");
            _from = Environment.GetEnvironmentVariable("SMTP_FROM");
            _tls  = Environment.GetEnvironmentVariable("SMTP_TLS")?.ToLower() != "false"; // default true
        }

        public async Task SendAsync(string to, string subject, string htmlBody)
        {
            if (!IsConfigured) { _log.LogWarning("SMTP not configured — skipping email to {To}", to); return; }
            try
            {
                using var client = BuildClient();
                using var msg    = BuildMessage(to, subject, htmlBody);
                await client.SendMailAsync(msg);
                _log.LogInformation("Email sent to {To}: {Subject}", to, subject);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to send email to {To}", to);
            }
        }

        public async Task SendManyAsync(IEnumerable<string> recipients, string subject, string htmlBody)
        {
            if (!IsConfigured) { _log.LogWarning("SMTP not configured — skipping bulk email"); return; }
            var tasks = recipients.Distinct().Select(r => SendAsync(r, subject, htmlBody));
            await Task.WhenAll(tasks);
        }

        private SmtpClient BuildClient()
        {
            var client = new SmtpClient(_host, _port)
            {
                EnableSsl   = _tls,
                DeliveryMethod = SmtpDeliveryMethod.Network,
            };
            if (!string.IsNullOrWhiteSpace(_user))
                client.Credentials = new NetworkCredential(_user, _pass);
            return client;
        }

        private MailMessage BuildMessage(string to, string subject, string htmlBody)
        {
            var msg = new MailMessage
            {
                From       = new MailAddress(_from!, "ShepherdCare"),
                Subject    = subject,
                Body       = htmlBody,
                IsBodyHtml = true,
            };
            msg.To.Add(to);
            return msg;
        }
    }
}
