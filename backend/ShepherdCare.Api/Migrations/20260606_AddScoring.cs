using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShepherdCare.Api.Migrations
{
    public partial class AddScoring : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ScoreCategories",
                columns: table => new
                {
                    Id = table.Column<Guid>(nullable: false),
                    Name = table.Column<string>(maxLength: 255, nullable: false),
                    Description = table.Column<string>(nullable: true),
                    MaxScore = table.Column<int>(nullable: false, defaultValue: 100),
                    IsPredefined = table.Column<bool>(nullable: false, defaultValue: false),
                    IsActive = table.Column<bool>(nullable: false, defaultValue: true),
                    CreatedById = table.Column<Guid>(nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScoreCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScoreEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(nullable: false),
                    MemberId = table.Column<Guid>(nullable: false),
                    CategoryId = table.Column<Guid>(nullable: false),
                    ScoreValue = table.Column<int>(nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Description = table.Column<string>(nullable: true),
                    RecordedById = table.Column<Guid>(nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScoreEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScoreEntries_FamilyMembers_MemberId",
                        column: x => x.MemberId,
                        principalTable: "FamilyMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScoreEntries_ScoreCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "ScoreCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScoreEntries_Users_RecordedById",
                        column: x => x.RecordedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScoreEntries_MemberId",
                table: "ScoreEntries",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_ScoreEntries_CategoryId",
                table: "ScoreEntries",
                column: "CategoryId");

            // Seed predefined categories
            migrationBuilder.Sql(@"
                INSERT INTO ""ScoreCategories"" (""Id"", ""Name"", ""Description"", ""MaxScore"", ""IsPredefined"", ""IsActive"", ""CreatedById"", ""CreatedAt"")
                SELECT
                    gen_random_uuid(),
                    name,
                    description,
                    100,
                    true,
                    true,
                    (SELECT ""Id"" FROM ""Users"" WHERE ""Username"" = 'superadmin' LIMIT 1),
                    NOW()
                FROM (VALUES
                    ('القداس',    'حضور القداس الإلهي'),
                    ('التناول',   'تناول القربان المقدس'),
                    ('الاعتراف',  'سر الاعتراف المقدس'),
                    ('الاجتماع',  'حضور الاجتماع الأسبوعي')
                ) AS t(name, description)
                WHERE NOT EXISTS (
                    SELECT 1 FROM ""ScoreCategories"" WHERE ""Name"" = t.name AND ""IsPredefined"" = true
                );
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ScoreEntries");
            migrationBuilder.DropTable(name: "ScoreCategories");
        }
    }
}
