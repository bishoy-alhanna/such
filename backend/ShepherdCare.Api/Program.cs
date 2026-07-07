using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authorization;
using ShepherdCare.Api.Data;
using ShepherdCare.Api.Services;
using ShepherdCare.Api.Middleware;
using ShepherdCare.Api.Authorization;
using System.Text;
using FluentValidation.AspNetCore;
using FluentValidation;

// Allow DateTime with Unspecified kind to be stored/read as-is (treats timestamps as local/unspecified)
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// Configuration
var configuration = builder.Configuration;

// Add services
builder.Services.AddControllers(options =>
{
    // Add global model validation filter to produce structured validation responses
    options.Filters.Add<ShepherdCare.Api.Filters.ValidationFilter>();
})
.AddJsonOptions(opts =>
{
    // Prevent circular reference crashes (e.g. Family → Members → FamilyMember.Family → ...)
    opts.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    opts.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});
// FluentValidation: automatic model validation
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddFluentValidationClientsideAdapters();
// Discover validators in the current assembly
builder.Services.AddValidatorsFromAssemblyContaining<ShepherdCare.Api.Validators.FamilyCreateDtoValidator>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// DbContext
var connStr = Environment.GetEnvironmentVariable("CONNECTION_STRING") ?? configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrEmpty(connStr))
    throw new InvalidOperationException("CONNECTION_STRING is not set.");

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connStr));

// Auth - JWT
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET") ?? configuration["Jwt:Secret"];
if (string.IsNullOrEmpty(jwtSecret))
    throw new InvalidOperationException("JWT_SECRET is not set.");

var key = Encoding.UTF8.GetBytes(jwtSecret);
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = true;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key)
    };
});

// Authorization and policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CanViewPriestNotes", policy => policy.RequireRole("Priest", "SeniorPriest"));
    // Resource-based policy for priest note access
    options.AddPolicy("CanAccessPriestNote", policy => policy.Requirements.Add(new AssignedPriestRequirement()));
});

// Register authorization handler
    // Register authorization handler
    // Register as scoped so the handler can consume scoped services like AppDbContext
    builder.Services.AddScoped<IAuthorizationHandler, AssignedPriestHandler>();

// Tenant context — scoped so each HTTP request gets its own instance
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

// Services
builder.Services.AddScoped<IEncryptionService, AesEncryptionService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddHostedService<WeeklyDigestService>();
builder.Services.AddHostedService<PastoralRemindersService>();

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()
        .WithOrigins("http://localhost:3000")
    );
});

var app = builder.Build();

// Apply migrations at startup (optional, for dev)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // EnsureCreated creates both the database and the full model schema on first boot.
    // On subsequent restarts the database exists, so it returns false and does nothing.
    // (Migrate() is not used because migration files are missing [Migration] attributes.)
    try
    {
        db.Database.EnsureCreated();
        // Idempotent column additions for schema evolution (EnsureCreated won't re-run on existing DBs)
        db.Database.ExecuteSqlRaw(
            "ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"FamilyMemberId\" uuid NULL;" +
            "ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"PendingApproval\" boolean NOT NULL DEFAULT false;" +
            "ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"Email\" text NULL;");
        db.Database.ExecuteSqlRaw(
            "ALTER TABLE \"Families\" ADD COLUMN IF NOT EXISTS \"Latitude\" double precision NULL;" +
            "ALTER TABLE \"Families\" ADD COLUMN IF NOT EXISTS \"Longitude\" double precision NULL;" +
            "ALTER TABLE \"Families\" ADD COLUMN IF NOT EXISTS \"CreatedAt\" timestamptz NOT NULL DEFAULT NOW();");
        db.Database.ExecuteSqlRaw(
            "ALTER TABLE \"Areas\" ADD COLUMN IF NOT EXISTS \"Color\" text NOT NULL DEFAULT '#6366f1';" +
            "ALTER TABLE \"Areas\" ADD COLUMN IF NOT EXISTS \"BoundaryJson\" text NULL;");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS ""Buildings"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""StreetId"" uuid NOT NULL REFERENCES ""Streets""(""Id"") ON DELETE CASCADE,
                ""Name"" text NOT NULL
            );");

        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS ""ScoreCategories"" (
                ""Id""           uuid NOT NULL PRIMARY KEY,
                ""Name""         text NOT NULL,
                ""Description""  text NULL,
                ""MaxScore""     integer NOT NULL DEFAULT 100,
                ""IsPredefined"" boolean NOT NULL DEFAULT false,
                ""IsActive""     boolean NOT NULL DEFAULT true,
                ""CreatedById""  uuid NOT NULL,
                ""CreatedAt""    timestamptz NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS ""ScoreEntries"" (
                ""Id""           uuid NOT NULL PRIMARY KEY,
                ""MemberId""     uuid NOT NULL REFERENCES ""FamilyMembers""(""Id"") ON DELETE CASCADE,
                ""CategoryId""   uuid NOT NULL REFERENCES ""ScoreCategories""(""Id"") ON DELETE RESTRICT,
                ""ScoreValue""   integer NOT NULL,
                ""Date""         timestamptz NOT NULL,
                ""Description""  text NULL,
                ""RecordedById"" uuid NOT NULL REFERENCES ""Users""(""Id"") ON DELETE RESTRICT,
                ""CreatedAt""    timestamptz NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS ""IX_ScoreEntries_MemberId""   ON ""ScoreEntries""(""MemberId"");
            CREATE INDEX IF NOT EXISTS ""IX_ScoreEntries_CategoryId"" ON ""ScoreEntries""(""CategoryId"");
        ");

        db.Database.ExecuteSqlRaw(@"
            ALTER TABLE ""ScoreCategories"" ADD COLUMN IF NOT EXISTS ""ClassId"" uuid NULL;
            ALTER TABLE ""ScoreCategories"" ADD COLUMN IF NOT EXISTS ""GroupId"" uuid NULL;
        ");

        // Remove duplicate FamilyLinks — keep only the oldest link for each (FamilyId, LinkedFamilyId) pair.
        // Duplicates were created by earlier buggy signup attempts.
        db.Database.ExecuteSqlRaw(@"
            DELETE FROM ""FamilyLinks""
            WHERE ""Id"" IN (
                SELECT ""Id"" FROM (
                    SELECT ""Id"",
                           ROW_NUMBER() OVER (PARTITION BY LEAST(""FamilyId""::text, ""LinkedFamilyId""::text),
                                                            GREATEST(""FamilyId""::text, ""LinkedFamilyId""::text)
                                              ORDER BY ""Id"") AS rn
                    FROM ""FamilyLinks""
                ) t WHERE rn > 1
            );
        ");

        // Seed Member role for existing databases
        db.Database.ExecuteSqlRaw(@"
            INSERT INTO ""Roles"" (""Id"", ""Name"", ""Description"")
            SELECT gen_random_uuid(), 'Member', 'Church member (self-registered)'
            WHERE NOT EXISTS (SELECT 1 FROM ""Roles"" WHERE ""Name"" = 'Member');
        ");

        // Seed predefined score categories
        db.Database.ExecuteSqlRaw(@"
            INSERT INTO ""ScoreCategories"" (""Id"", ""Name"", ""Description"", ""MaxScore"", ""IsPredefined"", ""IsActive"", ""CreatedById"", ""CreatedAt"")
            SELECT gen_random_uuid(), t.name, t.description, 100, true, true,
                   COALESCE((SELECT ""Id"" FROM ""Users"" WHERE ""Username"" = 'superadmin' LIMIT 1), '00000000-0000-0000-0000-000000000001'::uuid),
                   NOW()
            FROM (VALUES
                ('القداس',   'حضور القداس الإلهي'),
                ('التناول',  'تناول القربان المقدس'),
                ('الاعتراف', 'سر الاعتراف المقدس'),
                ('الاجتماع', 'حضور الاجتماع الأسبوعي')
            ) AS t(name, description)
            WHERE NOT EXISTS (
                SELECT 1 FROM ""ScoreCategories"" WHERE ""Name"" = t.name AND ""IsPredefined"" = true
            );
        ");

    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Warning: schema creation failed: {ex.Message}");
    }

    // BaptismName / NameDay columns on FamilyMembers
    try
    {
        db.Database.ExecuteSqlRaw(
            "ALTER TABLE \"FamilyMembers\" ADD COLUMN IF NOT EXISTS \"BaptismName\" text NULL;" +
            "ALTER TABLE \"FamilyMembers\" ADD COLUMN IF NOT EXISTS \"NameDayMonth\" integer NULL;" +
            "ALTER TABLE \"FamilyMembers\" ADD COLUMN IF NOT EXISTS \"NameDayDay\" integer NULL;");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Warning: FamilyMember coptic columns failed: {ex.Message}");
    }

    // Allow members to be created standalone (no family yet), linked later via the father's National ID
    try
    {
        db.Database.ExecuteSqlRaw("ALTER TABLE \"FamilyMembers\" ALTER COLUMN \"FamilyId\" DROP NOT NULL;");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Warning: FamilyMembers.FamilyId nullable migration failed: {ex.Message}");
    }

    // Sacramental milestones table
    try
    {
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS ""SacramentalMilestones"" (
                ""Id""            uuid        NOT NULL PRIMARY KEY,
                ""MemberId""      uuid        NOT NULL REFERENCES ""FamilyMembers""(""Id"") ON DELETE CASCADE,
                ""Type""          text        NOT NULL,
                ""Date""          timestamptz NOT NULL,
                ""Notes""         text        NULL,
                ""RecordedById""  uuid        NOT NULL REFERENCES ""Users""(""Id"") ON DELETE RESTRICT,
                ""CreatedAt""     timestamptz NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS ""IX_SacramentalMilestones_MemberId""
                ON ""SacramentalMilestones""(""MemberId"");
        ");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Warning: sacramental milestones schema creation failed: {ex.Message}");
    }

    // Events + EventAttendances + FollowUpTasks tables
    try
    {
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS ""Events"" (
                ""Id""             uuid        NOT NULL PRIMARY KEY,
                ""Title""          text        NOT NULL,
                ""Description""    text        NULL,
                ""Type""           text        NOT NULL DEFAULT 'Other',
                ""StartDateTime""  timestamptz NOT NULL,
                ""EndDateTime""    timestamptz NULL,
                ""Location""       text        NULL,
                ""ClassId""        uuid        NULL REFERENCES ""Classes""(""Id"") ON DELETE SET NULL,
                ""GroupId""        uuid        NULL REFERENCES ""Groups""(""Id"") ON DELETE SET NULL,
                ""IsRecurring""    boolean     NOT NULL DEFAULT false,
                ""RecurrenceType"" text        NOT NULL DEFAULT 'None',
                ""CreatedById""    uuid        NOT NULL REFERENCES ""Users""(""Id"") ON DELETE RESTRICT,
                ""CreatedAt""      timestamptz NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS ""IX_Events_StartDateTime"" ON ""Events""(""StartDateTime"");

            CREATE TABLE IF NOT EXISTS ""EventAttendances"" (
                ""Id""          uuid        NOT NULL PRIMARY KEY,
                ""EventId""     uuid        NOT NULL REFERENCES ""Events""(""Id"") ON DELETE CASCADE,
                ""MemberId""    uuid        NOT NULL REFERENCES ""FamilyMembers""(""Id"") ON DELETE CASCADE,
                ""Status""      text        NOT NULL DEFAULT 'Present',
                ""MarkedById""  uuid        NOT NULL REFERENCES ""Users""(""Id"") ON DELETE RESTRICT,
                ""MarkedAt""    timestamptz NOT NULL DEFAULT NOW(),
                UNIQUE(""EventId"", ""MemberId"")
            );
            CREATE INDEX IF NOT EXISTS ""IX_EventAttendances_EventId"" ON ""EventAttendances""(""EventId"");

            CREATE TABLE IF NOT EXISTS ""FollowUpTasks"" (
                ""Id""               uuid        NOT NULL PRIMARY KEY,
                ""Title""            text        NOT NULL,
                ""Notes""            text        NULL,
                ""DueDate""          timestamptz NULL,
                ""Status""           text        NOT NULL DEFAULT 'Open',
                ""AssignedToUserId"" uuid        NOT NULL REFERENCES ""Users""(""Id"") ON DELETE RESTRICT,
                ""RelatedMemberId""  uuid        NULL REFERENCES ""FamilyMembers""(""Id"") ON DELETE SET NULL,
                ""RelatedVisitId""   uuid        NULL REFERENCES ""Visits""(""Id"") ON DELETE SET NULL,
                ""CreatedById""      uuid        NOT NULL REFERENCES ""Users""(""Id"") ON DELETE RESTRICT,
                ""CreatedAt""        timestamptz NOT NULL DEFAULT NOW(),
                ""CompletedAt""      timestamptz NULL
            );
            CREATE INDEX IF NOT EXISTS ""IX_FollowUpTasks_AssignedToUserId"" ON ""FollowUpTasks""(""AssignedToUserId"");
            CREATE INDEX IF NOT EXISTS ""IX_FollowUpTasks_Status"" ON ""FollowUpTasks""(""Status"");
        ");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Warning: Events/FollowUpTasks schema creation failed: {ex.Message}");
    }

    // Notifications table
    try
    {
        db.Database.ExecuteSqlRaw(
            "CREATE TABLE IF NOT EXISTS \"Notifications\" (" +
            "    \"Id\"        uuid NOT NULL PRIMARY KEY," +
            "    \"UserId\"    uuid NOT NULL REFERENCES \"Users\"(\"Id\") ON DELETE CASCADE," +
            "    \"Title\"     text NOT NULL," +
            "    \"Body\"      text NOT NULL," +
            "    \"Type\"      text NOT NULL," +
            "    \"Link\"      text NULL," +
            "    \"IsRead\"    boolean NOT NULL DEFAULT false," +
            "    \"CreatedAt\" timestamptz NOT NULL DEFAULT NOW()" +
            ");" +
            "CREATE INDEX IF NOT EXISTS \"IX_Notifications_UserId\" ON \"Notifications\"(\"UserId\");" +
            "CREATE INDEX IF NOT EXISTS \"IX_Notifications_UserId_IsRead\" ON \"Notifications\"(\"UserId\", \"IsRead\");"
        );
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Warning: notifications schema creation failed: {ex.Message}");
    }

    // Pending approvals tables — separate try so pre-existing failures above don't block this
    try
    {
        db.Database.ExecuteSqlRaw(
            "CREATE TABLE IF NOT EXISTS \"PendingScores\" (" +
            "    \"Id\"            uuid NOT NULL PRIMARY KEY," +
            "    \"MemberId\"      uuid NOT NULL REFERENCES \"FamilyMembers\"(\"Id\") ON DELETE CASCADE," +
            "    \"CategoryId\"    uuid NOT NULL REFERENCES \"ScoreCategories\"(\"Id\") ON DELETE RESTRICT," +
            "    \"Date\"          timestamptz NOT NULL," +
            "    \"Note\"          text NULL," +
            "    \"Status\"        text NOT NULL DEFAULT 'Pending'," +
            "    \"SubmittedById\" uuid NOT NULL REFERENCES \"Users\"(\"Id\") ON DELETE RESTRICT," +
            "    \"SubmittedAt\"   timestamptz NOT NULL DEFAULT NOW()," +
            "    \"ReviewedById\"  uuid NULL," +
            "    \"ReviewedAt\"    timestamptz NULL," +
            "    \"ReviewNote\"    text NULL" +
            ");" +
            "CREATE INDEX IF NOT EXISTS \"IX_PendingScores_MemberId\" ON \"PendingScores\"(\"MemberId\");"
        );
        db.Database.ExecuteSqlRaw(
            "CREATE TABLE IF NOT EXISTS \"PendingMemberUpdates\" (" +
            "    \"Id\"            uuid NOT NULL PRIMARY KEY," +
            "    \"MemberId\"      uuid NOT NULL REFERENCES \"FamilyMembers\"(\"Id\") ON DELETE CASCADE," +
            "    \"ChangesJson\"   text NOT NULL," +
            "    \"Status\"        text NOT NULL DEFAULT 'Pending'," +
            "    \"SubmittedById\" uuid NOT NULL REFERENCES \"Users\"(\"Id\") ON DELETE RESTRICT," +
            "    \"SubmittedAt\"   timestamptz NOT NULL DEFAULT NOW()," +
            "    \"ReviewedById\"  uuid NULL," +
            "    \"ReviewedAt\"    timestamptz NULL," +
            "    \"ReviewNote\"    text NULL" +
            ");" +
            "CREATE INDEX IF NOT EXISTS \"IX_PendingMemberUpdates_MemberId\" ON \"PendingMemberUpdates\"(\"MemberId\");"
        );
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Warning: pending approvals schema creation failed: {ex.Message}");
    }

    // Giving & Stewardship tables
    try
    {
        db.Database.ExecuteSqlRaw(
            "CREATE TABLE IF NOT EXISTS \"GivingRecords\" (" +
            "    \"Id\"             uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()," +
            "    \"FamilyId\"       uuid NOT NULL REFERENCES \"Families\"(\"Id\") ON DELETE CASCADE," +
            "    \"Amount\"         numeric(12,2) NOT NULL DEFAULT 0," +
            "    \"Date\"           date NOT NULL," +
            "    \"Type\"           text NOT NULL DEFAULT 'Tithe'," +
            "    \"Notes\"          text NULL," +
            "    \"IsConfidential\" boolean NOT NULL DEFAULT true," +
            "    \"RecordedById\"   uuid NOT NULL REFERENCES \"Users\"(\"Id\") ON DELETE RESTRICT," +
            "    \"CreatedAt\"      timestamptz NOT NULL DEFAULT NOW()" +
            ");" +
            "CREATE INDEX IF NOT EXISTS \"IX_GivingRecords_FamilyId\" ON \"GivingRecords\"(\"FamilyId\");" +

            "CREATE TABLE IF NOT EXISTS \"Pledges\" (" +
            "    \"Id\"             uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()," +
            "    \"FamilyId\"       uuid NOT NULL REFERENCES \"Families\"(\"Id\") ON DELETE CASCADE," +
            "    \"Year\"           integer NOT NULL," +
            "    \"PledgedAmount\"  numeric(12,2) NOT NULL DEFAULT 0," +
            "    \"Notes\"          text NULL," +
            "    \"IsActive\"       boolean NOT NULL DEFAULT true," +
            "    \"CreatedById\"    uuid NOT NULL REFERENCES \"Users\"(\"Id\") ON DELETE RESTRICT," +
            "    \"CreatedAt\"      timestamptz NOT NULL DEFAULT NOW()" +
            ");" +
            "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Pledges_FamilyId_Year\" ON \"Pledges\"(\"FamilyId\", \"Year\");"
        );
    }
    catch (Exception ex) { Console.Error.WriteLine($"Warning: giving schema: {ex.Message}"); }

    // Volunteer & service hours tables
    try
    {
        db.Database.ExecuteSqlRaw(
            "CREATE TABLE IF NOT EXISTS \"VolunteerAssignments\" (" +
            "    \"Id\"           uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()," +
            "    \"MemberId\"     uuid NOT NULL REFERENCES \"FamilyMembers\"(\"Id\") ON DELETE CASCADE," +
            "    \"Role\"         text NOT NULL DEFAULT 'Other'," +
            "    \"AssignedDate\" date NULL," +
            "    \"EventId\"      uuid NULL REFERENCES \"Events\"(\"Id\") ON DELETE SET NULL," +
            "    \"Notes\"        text NULL," +
            "    \"IsRecurring\"  boolean NOT NULL DEFAULT false," +
            "    \"CreatedById\"  uuid NOT NULL REFERENCES \"Users\"(\"Id\") ON DELETE RESTRICT," +
            "    \"CreatedAt\"    timestamptz NOT NULL DEFAULT NOW()" +
            ");" +
            "CREATE INDEX IF NOT EXISTS \"IX_VolunteerAssignments_MemberId\" ON \"VolunteerAssignments\"(\"MemberId\");" +
            "CREATE INDEX IF NOT EXISTS \"IX_VolunteerAssignments_AssignedDate\" ON \"VolunteerAssignments\"(\"AssignedDate\");" +

            "CREATE TABLE IF NOT EXISTS \"ServiceHours\" (" +
            "    \"Id\"           uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()," +
            "    \"MemberId\"     uuid NOT NULL REFERENCES \"FamilyMembers\"(\"Id\") ON DELETE CASCADE," +
            "    \"Date\"         date NOT NULL," +
            "    \"Hours\"        numeric(5,1) NOT NULL DEFAULT 0," +
            "    \"Activity\"     text NOT NULL DEFAULT ''," +
            "    \"Notes\"        text NULL," +
            "    \"RecordedById\" uuid NOT NULL REFERENCES \"Users\"(\"Id\") ON DELETE RESTRICT," +
            "    \"CreatedAt\"    timestamptz NOT NULL DEFAULT NOW()" +
            ");" +
            "CREATE INDEX IF NOT EXISTS \"IX_ServiceHours_MemberId\" ON \"ServiceHours\"(\"MemberId\");"
        );
    }
    catch (Exception ex) { Console.Error.WriteLine($"Warning: volunteer schema: {ex.Message}"); }

    // Ensure SpiritualRecords table exists (may be missing in older dev databases)
    try
    {
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS ""SpiritualRecords"" (
                ""Id""           uuid        NOT NULL PRIMARY KEY,
                ""MemberId""     uuid        NOT NULL REFERENCES ""FamilyMembers""(""Id"") ON DELETE CASCADE,
                ""Type""         text        NOT NULL,
                ""Date""         timestamptz NOT NULL,
                ""Notes""        text        NULL,
                ""RecordedBy""   uuid        NOT NULL REFERENCES ""Users""(""Id"") ON DELETE RESTRICT,
                ""CreatedAt""    timestamptz NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS ""IX_SpiritualRecords_MemberId"" ON ""SpiritualRecords""(""MemberId"");
        ");
    }
    catch (Exception ex) { Console.Error.WriteLine($"Warning: SpiritualRecords table: {ex.Message}"); }

    // Multi-tenancy: create Churches table + add ChurchId to all tenant tables (idempotent)
    const string defaultChurch = "00000000-0000-0000-0000-000000000001";
    try
    {
        db.Database.ExecuteSqlRaw($@"
            CREATE TABLE IF NOT EXISTS ""Churches"" (
                ""Id""           uuid        NOT NULL PRIMARY KEY,
                ""Name""         text        NOT NULL,
                ""Slug""         text        NOT NULL,
                ""IsActive""     boolean     NOT NULL DEFAULT false,
                ""LogoUrl""      text        NULL,
                ""ContactEmail"" text        NULL,
                ""City""         text        NULL,
                ""Country""      text        NULL,
                ""CreatedAt""    timestamptz NOT NULL DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Churches_Slug"" ON ""Churches""(""Slug"");
            INSERT INTO ""Churches"" (""Id"",""Name"",""Slug"",""IsActive"",""CreatedAt"")
            VALUES ('{defaultChurch}', 'Default Church', 'default', true, NOW())
            ON CONFLICT (""Id"") DO NOTHING;
        ");
    }
    catch (Exception ex) { Console.Error.WriteLine($"Warning: Churches table: {ex.Message}"); }

    // Add ChurchId to each tenant table independently — skip any that don't exist yet
    string[] tenantTables = [
        "Families","FamilyMembers","Visits","AuditLogs","Classes","Groups",
        "Notifications","ScoreCategories","GivingRecords","FollowUpTasks",
        "Events","AttendanceRecords","SpiritualRecords","PriestNotes","Areas"
    ];
    foreach (var t in tenantTables)
    {
        try
        {
            db.Database.ExecuteSqlRaw($@"
                ALTER TABLE ""{t}"" ADD COLUMN IF NOT EXISTS ""ChurchId"" uuid NULL;
                UPDATE ""{t}"" SET ""ChurchId"" = '{defaultChurch}' WHERE ""ChurchId"" IS NULL;
                ALTER TABLE ""{t}"" ALTER COLUMN ""ChurchId"" SET NOT NULL;
            ");
        }
        catch (Exception ex) { Console.Error.WriteLine($"Warning: ChurchId migration for {t}: {ex.Message.Split('\n')[0]}"); }
    }
    // Users.ChurchId stays nullable (null = SystemAdmin)
    try { db.Database.ExecuteSqlRaw(@"ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""ChurchId"" uuid NULL;"); }
    catch (Exception ex) { Console.Error.WriteLine($"Warning: Users.ChurchId: {ex.Message}"); }

    // Subscriptions table
    try
    {
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS ""Subscriptions"" (
                ""Id""          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
                ""ChurchId""    uuid        NOT NULL REFERENCES ""Churches""(""Id""),
                ""Plan""        int         NOT NULL DEFAULT 0,
                ""Status""      int         NOT NULL DEFAULT 0,
                ""BillingCycle"" int        NOT NULL DEFAULT 0,
                ""TrialEndsAt"" timestamptz NOT NULL,
                ""PeriodStart"" timestamptz NULL,
                ""PeriodEnd""   timestamptz NULL,
                ""Notes""       text        NULL,
                ""CreatedAt""   timestamptz NOT NULL DEFAULT now(),
                ""UpdatedAt""   timestamptz NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Subscriptions_ChurchId""
                ON ""Subscriptions""(""ChurchId"");

            -- Seed a 30-day trial for every church that doesn't have a subscription yet
            INSERT INTO ""Subscriptions"" (""Id"", ""ChurchId"", ""Plan"", ""Status"", ""TrialEndsAt"", ""CreatedAt"")
            SELECT gen_random_uuid(), c.""Id"", 0, 0, now() + interval '30 days', now()
            FROM   ""Churches"" c
            WHERE  NOT EXISTS (
                SELECT 1 FROM ""Subscriptions"" s WHERE s.""ChurchId"" = c.""Id""
            );");
    }
    catch (Exception ex) { Console.Error.WriteLine($"Warning: Subscriptions table: {ex.Message}"); }

    // Assign all legacy users (pre-multi-tenancy) that have no ChurchId to the Default Church,
    // unless they are SystemAdmin (identified by role name).
    try
    {
        db.Database.ExecuteSqlRaw($@"
            UPDATE ""Users"" u
            SET    ""ChurchId"" = '{defaultChurch}'
            FROM   ""Roles"" r
            WHERE  u.""RoleId"" = r.""Id""
              AND  r.""Name""  <> 'SystemAdmin'
              AND  u.""ChurchId"" IS NULL;");
    }
    catch (Exception ex) { Console.Error.WriteLine($"Warning: Users legacy ChurchId backfill: {ex.Message}"); }

    // Seed initial data (best-effort). Failures here should not crash the app in containerized dev envs.
    try
    {
        await ShepherdCare.Api.Data.DataSeeder.SeedAsync(db);
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Warning: seeding failed: {ex.Message}");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors();

// Serve uploaded files (profile photos etc.)
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "uploads");
Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles();

// Rate limiting middleware
app.UseSimpleRateLimit(20, TimeSpan.FromMinutes(1));

// Tenant resolution — must come before auth so controllers see the resolved church
app.UseMiddleware<TenantMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

// Subscription enforcement — runs after auth so we have the tenant resolved
app.UseMiddleware<SubscriptionMiddleware>();

app.MapControllers();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

app.Run();
