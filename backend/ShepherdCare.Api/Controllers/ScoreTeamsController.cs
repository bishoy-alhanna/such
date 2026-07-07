using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Models;
using System.Security.Claims;

namespace ShepherdCare.Api.Controllers
{
    [ApiController]
    [Route("api/score-teams")]
    [Authorize]
    public class ScoreTeamsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public ScoreTeamsController(AppDbContext db) => _db = db;

        private static readonly string[] ManagerRoles = ["SuperAdmin", "ServiceLeader", "Priest", "SeniorPriest", "Servant", "DataEntry"];

        private (bool ok, Guid userId, string role) GetCaller()
        {
            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var role = User.FindFirstValue(ClaimTypes.Role) ?? "";
            if (!Guid.TryParse(uid, out var id)) return (false, Guid.Empty, role);
            return (true, id, role);
        }

        private async Task<bool> CanManageAsync(Guid userId, string role, Guid? classId, Guid? groupId)
        {
            if (role is "SuperAdmin" or "Priest" or "SeniorPriest") return true;
            if (role == "ServiceLeader")
            {
                if (groupId.HasValue)
                    return await _db.Groups.AnyAsync(g => g.Id == groupId.Value && g.ServantUserId == userId);
                if (classId.HasValue)
                {
                    var gId = await _db.Classes.Where(c => c.Id == classId.Value).Select(c => c.GroupId).FirstOrDefaultAsync();
                    return gId.HasValue && await _db.Groups.AnyAsync(g => g.Id == gId.Value && g.ServantUserId == userId);
                }
                return false;
            }
            if (role == "Servant")
            {
                if (classId.HasValue) return await _db.Servants.AnyAsync(s => s.UserId == userId && s.ClassId == classId.Value);
                if (groupId.HasValue)
                {
                    var classIds = await _db.Classes.Where(c => c.GroupId == groupId.Value).Select(c => c.Id).ToListAsync();
                    return await _db.Servants.AnyAsync(s => s.UserId == userId && classIds.Contains(s.ClassId));
                }
            }
            return false;
        }

        // GET /api/score-teams?classId=&groupId=
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] Guid? classId, [FromQuery] Guid? groupId)
        {
            var (ok, userId, role) = GetCaller();
            if (!ok) return Unauthorized();

            var query = _db.ScoreTeams
                .Include(t => t.Members).ThenInclude(m => m.Member)
                .AsQueryable();

            if (classId.HasValue) query = query.Where(t => t.ClassId == classId.Value);
            else if (groupId.HasValue) query = query.Where(t => t.GroupId == groupId.Value);
            else return BadRequest("Provide classId or groupId.");

            var teams = await query.OrderBy(t => t.Name).ToListAsync();

            return Ok(teams.Select(t => new {
                t.Id, t.Name, t.ClassId, t.GroupId,
                startDate = t.StartDate,
                endDate = t.EndDate,
                memberCount = t.Members.Count,
                members = t.Members.Select(m => new { m.MemberId, memberName = m.Member?.FullName, photoUrl = m.Member?.PhotoUrl })
            }));
        }

        // POST /api/score-teams
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ScoreTeamUpsertDto dto)
        {
            var (ok, userId, role) = GetCaller();
            if (!ok) return Unauthorized();
            if (!await CanManageAsync(userId, role, dto.ClassId, dto.GroupId)) return Forbid();
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");
            if (dto.ClassId == null && dto.GroupId == null) return BadRequest("Provide classId or groupId.");

            var team = new ScoreTeam
            {
                Id = Guid.NewGuid(),
                Name = dto.Name.Trim(),
                ClassId = dto.ClassId,
                GroupId = dto.GroupId,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow
            };
            _db.ScoreTeams.Add(team);
            await _db.SaveChangesAsync();
            return Ok(new { team.Id, team.Name, team.ClassId, team.GroupId, team.StartDate, team.EndDate });
        }

        // PUT /api/score-teams/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] ScoreTeamUpsertDto dto)
        {
            var (ok, userId, role) = GetCaller();
            if (!ok) return Unauthorized();
            var team = await _db.ScoreTeams.FindAsync(id);
            if (team == null) return NotFound();
            if (!await CanManageAsync(userId, role, team.ClassId, team.GroupId)) return Forbid();

            team.Name = dto.Name?.Trim() ?? team.Name;
            team.StartDate = dto.StartDate;
            team.EndDate = dto.EndDate;
            await _db.SaveChangesAsync();
            return Ok(new { team.Id, team.Name, team.ClassId, team.GroupId, team.StartDate, team.EndDate });
        }

        // DELETE /api/score-teams/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var (ok, userId, role) = GetCaller();
            if (!ok) return Unauthorized();
            var team = await _db.ScoreTeams.FindAsync(id);
            if (team == null) return NotFound();
            if (!await CanManageAsync(userId, role, team.ClassId, team.GroupId)) return Forbid();
            _db.ScoreTeams.Remove(team);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // POST /api/score-teams/{id}/members  body: { memberId }
        [HttpPost("{id}/members")]
        public async Task<IActionResult> AddMember(Guid id, [FromBody] TeamMemberDto dto)
        {
            var (ok, userId, role) = GetCaller();
            if (!ok) return Unauthorized();
            var team = await _db.ScoreTeams.FindAsync(id);
            if (team == null) return NotFound();
            if (!await CanManageAsync(userId, role, team.ClassId, team.GroupId)) return Forbid();

            var already = await _db.ScoreTeamMembers.AnyAsync(m => m.ScoreTeamId == id && m.MemberId == dto.MemberId);
            if (already) return Conflict("Member already in this team.");

            _db.ScoreTeamMembers.Add(new ScoreTeamMember { ScoreTeamId = id, MemberId = dto.MemberId });
            await _db.SaveChangesAsync();
            return Ok();
        }

        // DELETE /api/score-teams/{id}/members/{memberId}
        [HttpDelete("{id}/members/{memberId}")]
        public async Task<IActionResult> RemoveMember(Guid id, Guid memberId)
        {
            var (ok, userId, role) = GetCaller();
            if (!ok) return Unauthorized();
            var team = await _db.ScoreTeams.FindAsync(id);
            if (team == null) return NotFound();
            if (!await CanManageAsync(userId, role, team.ClassId, team.GroupId)) return Forbid();

            var entry = await _db.ScoreTeamMembers.FindAsync(id, memberId);
            if (entry == null) return NotFound();
            _db.ScoreTeamMembers.Remove(entry);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // GET /api/score-teams/{id}/leaderboard — individual member ranking within the team
        [HttpGet("{id}/leaderboard")]
        public async Task<IActionResult> GetTeamLeaderboard(Guid id,
            [FromQuery] Guid? categoryId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var team = await _db.ScoreTeams.FindAsync(id);
            if (team == null) return NotFound();

            var effectiveStart = startDate ?? team.StartDate;
            var effectiveEnd   = endDate   ?? team.EndDate;

            var memberIds = await _db.ScoreTeamMembers.Where(m => m.ScoreTeamId == id).Select(m => m.MemberId).ToListAsync();
            if (!memberIds.Any()) return Ok(new { teamId = id, teamName = team.Name, startDate = effectiveStart, endDate = effectiveEnd, members = Array.Empty<object>() });

            var sq = _db.ScoreEntries.Where(e => memberIds.Contains(e.MemberId));
            if (categoryId.HasValue) sq = sq.Where(e => e.CategoryId == categoryId.Value);
            if (effectiveStart.HasValue) sq = sq.Where(e => e.Date >= effectiveStart.Value);
            if (effectiveEnd.HasValue) sq = sq.Where(e => e.Date < effectiveEnd.Value.Date.AddDays(1));

            var scores = await sq.GroupBy(e => e.MemberId)
                .Select(g => new { memberId = g.Key, total = g.Sum(e => e.ScoreValue), count = g.Count() }).ToListAsync();
            var memberData = await _db.FamilyMembers.Where(m => memberIds.Contains(m.Id))
                .Select(m => new { m.Id, m.FullName, m.PhotoUrl }).ToListAsync();

            var lb = memberData.Select(m => {
                var s = scores.FirstOrDefault(x => x.memberId == m.Id);
                return new { memberId = m.Id, memberName = m.FullName, photoUrl = m.PhotoUrl, totalScore = s?.total ?? 0, count = s?.count ?? 0 };
            })
            .OrderByDescending(x => x.totalScore)
            .Select((x, i) => new { rank = i + 1, x.memberId, x.memberName, x.photoUrl, x.totalScore, x.count })
            .ToList();

            return Ok(new { teamId = id, teamName = team.Name, startDate = effectiveStart, endDate = effectiveEnd, members = lb });
        }

        // GET /api/score-teams/compare?classId=&groupId=&startDate=&endDate= — teams vs teams
        [HttpGet("compare")]
        public async Task<IActionResult> Compare(
            [FromQuery] Guid? classId, [FromQuery] Guid? groupId,
            [FromQuery] Guid? categoryId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            if (classId == null && groupId == null) return BadRequest("Provide classId or groupId.");

            var teamsQuery = _db.ScoreTeams.AsQueryable();
            if (classId.HasValue) teamsQuery = teamsQuery.Where(t => t.ClassId == classId.Value);
            else teamsQuery = teamsQuery.Where(t => t.GroupId == groupId.Value);

            var teams = await teamsQuery.ToListAsync();
            if (!teams.Any()) return Ok(new { teams = Array.Empty<object>() });

            var allMemberIds = await _db.ScoreTeamMembers
                .Where(m => teams.Select(t => t.Id).Contains(m.ScoreTeamId))
                .Select(m => new { m.ScoreTeamId, m.MemberId })
                .ToListAsync();

            var allIds = allMemberIds.Select(m => m.MemberId).Distinct().ToList();
            var sq = _db.ScoreEntries.Where(e => allIds.Contains(e.MemberId));
            if (categoryId.HasValue) sq = sq.Where(e => e.CategoryId == categoryId.Value);

            var result = new List<object>();
            foreach (var t in teams)
            {
                var effectiveStart = startDate ?? t.StartDate;
                var effectiveEnd   = endDate   ?? t.EndDate;
                var teamMemberIds  = allMemberIds.Where(m => m.ScoreTeamId == t.Id).Select(m => m.MemberId).ToList();
                var tsq = sq.Where(e => teamMemberIds.Contains(e.MemberId));
                if (effectiveStart.HasValue) tsq = tsq.Where(e => e.Date >= effectiveStart.Value);
                if (effectiveEnd.HasValue) tsq = tsq.Where(e => e.Date < effectiveEnd.Value.Date.AddDays(1));
                var scores = await tsq.GroupBy(e => e.MemberId)
                    .Select(g => new { memberId = g.Key, total = g.Sum(e => e.ScoreValue) }).ToListAsync();
                var total = scores.Sum(s => s.total);
                result.Add(new { teamId = t.Id, teamName = t.Name, memberCount = teamMemberIds.Count, totalScore = total, startDate = effectiveStart, endDate = effectiveEnd });
            }

            var ranked = result
                .OrderByDescending(x => ((dynamic)x).totalScore)
                .Select((x, i) => new { rank = i + 1, team = x })
                .ToList();

            return Ok(new { classId, groupId, teams = ranked });
        }
    }

    public class ScoreTeamUpsertDto
    {
        public string? Name { get; set; }
        public Guid? ClassId { get; set; }
        public Guid? GroupId { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }

    public class TeamMemberDto { public Guid MemberId { get; set; } }
}
