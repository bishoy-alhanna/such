using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Models;

namespace ShepherdCare.Api.Data
{
    public static class DataSeeder
    {
        public static async Task SeedAsync(AppDbContext db)
        {
            // Ensure new tables added after initial migration exist
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""Areas"" (
                    ""Id""   uuid NOT NULL PRIMARY KEY,
                    ""Name"" text NOT NULL UNIQUE
                );
                CREATE TABLE IF NOT EXISTS ""Streets"" (
                    ""Id""     uuid NOT NULL PRIMARY KEY,
                    ""AreaId"" uuid NOT NULL REFERENCES ""Areas""(""Id"") ON DELETE CASCADE,
                    ""Name""   text NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_Streets_AreaId"" ON ""Streets""(""AreaId"");

                CREATE TABLE IF NOT EXISTS ""Groups"" (
                    ""Id""            uuid NOT NULL PRIMARY KEY,
                    ""Name""          text NOT NULL,
                    ""ServantUserId"" uuid NULL
                );

                ALTER TABLE ""Classes"" ADD COLUMN IF NOT EXISTS ""GroupId"" uuid NULL REFERENCES ""Groups""(""Id"") ON DELETE SET NULL;
                ALTER TABLE ""Classes"" ALTER COLUMN ""ServiceId"" DROP NOT NULL;
                ALTER TABLE ""FamilyMembers"" ADD COLUMN IF NOT EXISTS ""NationalId"" text NULL;

                CREATE TABLE IF NOT EXISTS ""FamilyLinks"" (
                    ""Id""             uuid NOT NULL PRIMARY KEY,
                    ""FamilyId""       uuid NOT NULL REFERENCES ""Families""(""Id"") ON DELETE CASCADE,
                    ""LinkedFamilyId"" uuid NOT NULL REFERENCES ""Families""(""Id"") ON DELETE RESTRICT,
                    ""RelationLabel""  text NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_FamilyLinks_FamilyId"" ON ""FamilyLinks""(""FamilyId"");
                CREATE INDEX IF NOT EXISTS ""IX_FamilyLinks_LinkedFamilyId"" ON ""FamilyLinks""(""LinkedFamilyId"");

                CREATE TABLE IF NOT EXISTS ""Visits"" (
                    ""Id""              uuid NOT NULL PRIMARY KEY,
                    ""VisitType""       text NOT NULL,
                    ""TargetType""      text NOT NULL,
                    ""VisitorType""     text NOT NULL,
                    ""MemberId""        uuid NULL REFERENCES ""FamilyMembers""(""Id"") ON DELETE CASCADE,
                    ""FamilyId""        uuid NULL REFERENCES ""Families""(""Id"") ON DELETE CASCADE,
                    ""VisitorUserId""   uuid NOT NULL REFERENCES ""Users""(""Id"") ON DELETE RESTRICT,
                    ""VisitDate""       timestamp NOT NULL,
                    ""Notes""           text NULL,
                    ""Purpose""         text NULL,
                    ""Outcome""         text NULL,
                    ""NextActionDate""  timestamp NULL,
                    ""FollowUpRequired"" boolean NOT NULL DEFAULT false,
                    ""CreatedAt""       timestamp NOT NULL,
                    ""UpdatedAt""       timestamp NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_Visits_MemberId"" ON ""Visits""(""MemberId"");
                CREATE INDEX IF NOT EXISTS ""IX_Visits_FamilyId"" ON ""Visits""(""FamilyId"");
                CREATE INDEX IF NOT EXISTS ""IX_Visits_VisitorUserId"" ON ""Visits""(""VisitorUserId"");
                CREATE INDEX IF NOT EXISTS ""IX_Visits_VisitDate"" ON ""Visits""(""VisitDate"");
            ");
            // Some environments (like fresh containers) might have inconsistent state. Attempt to read Roles; if it fails and
            // DEV_AUTO_INIT=true, recreate the schema (EnsureDeleted + EnsureCreated) and proceed. This is safe for local/dev only.
            try
            {
                if (!db.Roles.Any())
                {
                    var roles = new[] {
                        new Role { Name = "SuperAdmin", Description = "Full access" },
                        new Role { Name = "Priest", Description = "Priest" },
                        new Role { Name = "SeniorPriest", Description = "Senior priest" },
                        new Role { Name = "ServiceLeader", Description = "Service leader" },
                        new Role { Name = "Servant", Description = "Servant" },
                        new Role { Name = "Member", Description = "Church member (self-registered)" },
                        new Role { Name = "DataEntry", Description = "Data entry" }
                    };
                    db.Roles.AddRange(roles);
                    await db.SaveChangesAsync();
                }

                if (!db.Users.Any())
                {
                    var adminRole = db.Roles.First(r => r.Name == "SuperAdmin");
                    var user = new User
                    {
                        Username = "admin",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                        RoleId = adminRole.Id,
                        DisplayName = "Administrator"
                    };
                    db.Users.Add(user);
                    await db.SaveChangesAsync();
                }
            }
            catch (Npgsql.PostgresException ex) when (ex.SqlState == "42P01") // undefined table
            {
                var auto = Environment.GetEnvironmentVariable("DEV_AUTO_INIT");
                if (string.Equals(auto, "true", StringComparison.OrdinalIgnoreCase))
                {
                    // destructive but helpful in dev: recreate schema
                    db.Database.EnsureDeleted();
                    db.Database.EnsureCreated();
                    // retry once
                    await SeedAsync(db);
                    return;
                }

                throw;
            }
        }
    }
}
