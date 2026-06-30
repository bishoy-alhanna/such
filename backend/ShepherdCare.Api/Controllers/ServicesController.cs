using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.DTOs;
using ShepherdCare.Api.Models;
using ShepherdCare.Api.Services;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ServicesController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IAuditService _audit;

        public ServicesController(AppDbContext db, IAuditService audit)
        {
            _db = db;
            _audit = audit;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _db.Services.Include(s => s.Classes).ToListAsync();
            return Ok(list);
        }

        [HttpPost]
        public async Task<IActionResult> Create(ServiceCreateDto dto)
        {
            var s = new Service { ServiceName = dto.ServiceName, ServiceLeaderId = dto.ServiceLeaderId, Description = dto.Description };
            _db.Services.Add(s);
            await _db.SaveChangesAsync();

            await _audit.LogAsync(new AuditLog { Action = "CreateService", PerformedBy = User.Identity?.Name ?? "system", Entity = "Service", EntityId = s.Id.ToString(), Details = s.ServiceName });

            return CreatedAtAction(nameof(GetAll), new { id = s.Id }, s);
        }
    }
}
