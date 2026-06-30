using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShepherdCare.Api.Migrations
{
    public partial class AddPendingApprovals : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PendingScores",
                columns: table => new
                {
                    Id = table.Column<Guid>(nullable: false),
                    MemberId = table.Column<Guid>(nullable: false),
                    CategoryId = table.Column<Guid>(nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Note = table.Column<string>(nullable: true),
                    Status = table.Column<string>(maxLength: 20, nullable: false, defaultValue: "Pending"),
                    SubmittedById = table.Column<Guid>(nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    ReviewedById = table.Column<Guid>(nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewNote = table.Column<string>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PendingScores", x => x.Id);
                    table.ForeignKey("FK_PendingScores_FamilyMembers_MemberId", x => x.MemberId, "FamilyMembers", "Id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_PendingScores_ScoreCategories_CategoryId", x => x.CategoryId, "ScoreCategories", "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey("FK_PendingScores_Users_SubmittedById", x => x.SubmittedById, "Users", "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PendingMemberUpdates",
                columns: table => new
                {
                    Id = table.Column<Guid>(nullable: false),
                    MemberId = table.Column<Guid>(nullable: false),
                    ChangesJson = table.Column<string>(nullable: false, defaultValue: "{}"),
                    Status = table.Column<string>(maxLength: 20, nullable: false, defaultValue: "Pending"),
                    SubmittedById = table.Column<Guid>(nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    ReviewedById = table.Column<Guid>(nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewNote = table.Column<string>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PendingMemberUpdates", x => x.Id);
                    table.ForeignKey("FK_PendingMemberUpdates_FamilyMembers_MemberId", x => x.MemberId, "FamilyMembers", "Id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_PendingMemberUpdates_Users_SubmittedById", x => x.SubmittedById, "Users", "Id", onDelete: ReferentialAction.Restrict);
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable("PendingScores");
            migrationBuilder.DropTable("PendingMemberUpdates");
        }
    }
}
