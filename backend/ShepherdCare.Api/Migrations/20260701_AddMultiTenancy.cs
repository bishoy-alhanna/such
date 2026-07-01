using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShepherdCare.Api.Migrations
{
    public partial class AddMultiTenancy : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create Churches table
            migrationBuilder.CreateTable(
                name: "Churches",
                columns: table => new
                {
                    Id           = table.Column<Guid>(type: "uuid",    nullable: false),
                    Name         = table.Column<string>(type: "text",  nullable: false),
                    Slug         = table.Column<string>(type: "text",  nullable: false),
                    IsActive     = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    LogoUrl      = table.Column<string>(type: "text",  nullable: true),
                    ContactEmail = table.Column<string>(type: "text",  nullable: true),
                    City         = table.Column<string>(type: "text",  nullable: true),
                    Country      = table.Column<string>(type: "text",  nullable: true),
                    CreatedAt    = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Churches", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Churches_Slug",
                table: "Churches",
                column: "Slug",
                unique: true);

            // 2. Insert the default church (all existing data belongs here)
            var defaultChurchId = new Guid("00000000-0000-0000-0000-000000000001");
            migrationBuilder.InsertData(
                table: "Churches",
                columns: new[] { "Id", "Name", "Slug", "IsActive", "CreatedAt" },
                values: new object[] { defaultChurchId, "Default Church", "default", true, DateTime.UtcNow });

            // 3. Add nullable ChurchId columns so we can backfill before making NOT NULL
            string[] nonNullableTables =
            [
                "Families", "FamilyMembers", "Visits", "AuditLogs",
                "Classes", "Groups", "Notifications", "ScoreCategories",
                "GivingRecords", "FollowUpTasks", "Events", "AttendanceRecords",
                "SpiritualRecords", "PriestNotes", "Areas"
            ];

            foreach (var table in nonNullableTables)
            {
                migrationBuilder.AddColumn<Guid>(
                    name: "ChurchId",
                    table: table,
                    type: "uuid",
                    nullable: true);

                // Backfill to default church
                migrationBuilder.Sql($"UPDATE \"{table}\" SET \"ChurchId\" = '{defaultChurchId}'");

                // Make NOT NULL
                migrationBuilder.AlterColumn<Guid>(
                    name: "ChurchId",
                    table: table,
                    type: "uuid",
                    nullable: false,
                    oldClrType: typeof(Guid?),
                    oldType: "uuid",
                    oldNullable: true);
            }

            // Users.ChurchId stays nullable (null = SystemAdmin, no church)
            migrationBuilder.AddColumn<Guid>(
                name: "ChurchId",
                table: "Users",
                type: "uuid",
                nullable: true);

            // Add FK indexes for performance
            foreach (var table in nonNullableTables)
            {
                migrationBuilder.CreateIndex(
                    name: $"IX_{table}_ChurchId",
                    table: table,
                    column: "ChurchId");
            }

            migrationBuilder.CreateIndex(
                name: "IX_Users_ChurchId",
                table: "Users",
                column: "ChurchId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            string[] nonNullableTables =
            [
                "Families", "FamilyMembers", "Visits", "AuditLogs",
                "Classes", "Groups", "Notifications", "ScoreCategories",
                "GivingRecords", "FollowUpTasks", "Events", "AttendanceRecords",
                "SpiritualRecords", "PriestNotes", "Areas"
            ];

            foreach (var table in nonNullableTables)
            {
                migrationBuilder.DropIndex(name: $"IX_{table}_ChurchId", table: table);
                migrationBuilder.DropColumn(name: "ChurchId", table: table);
            }

            migrationBuilder.DropIndex(name: "IX_Users_ChurchId", table: "Users");
            migrationBuilder.DropColumn(name: "ChurchId", table: "Users");

            migrationBuilder.DropTable(name: "Churches");
        }
    }
}
