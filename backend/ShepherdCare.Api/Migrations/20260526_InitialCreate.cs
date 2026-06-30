using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShepherdCare.Api.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table => { table.PrimaryKey("PK_Roles", x => x.Id); });

            migrationBuilder.CreateTable(
                name: "Families",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FamilyName = table.Column<string>(type: "text", nullable: false),
                    Address = table.Column<string>(type: "text", nullable: true),
                    Area = table.Column<string>(type: "text", nullable: true),
                    PhoneNumbers = table.Column<string>(type: "text", nullable: true),
                    AssignedPriestId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table => { table.PrimaryKey("PK_Families", x => x.Id); });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Username = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    DisplayName = table.Column<string>(type: "text", nullable: true),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => { table.PrimaryKey("PK_Users", x => x.Id); table.ForeignKey("FK_Users_Roles_RoleId", x => x.RoleId, "Roles", "Id", onDelete: ReferentialAction.Cascade); });

            // Additional tables (FamilyMembers, PriestNotes, Visits, Services, Classes, Enrollment, Attendance, AuditLogs)
            migrationBuilder.CreateTable(
                name: "FamilyMembers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FamilyId = table.Column<Guid>(type: "uuid", nullable: false),
                    FullName = table.Column<string>(type: "text", nullable: false),
                    Gender = table.Column<string>(type: "text", nullable: true),
                    DateOfBirth = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Relation = table.Column<string>(type: "text", nullable: true),
                    Mobile = table.Column<string>(type: "text", nullable: true),
                    IsChild = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table => { table.PrimaryKey("PK_FamilyMembers", x => x.Id); table.ForeignKey("FK_FamilyMembers_Families_FamilyId", x => x.FamilyId, "Families", "Id", onDelete: ReferentialAction.Cascade); });

            migrationBuilder.CreateTable(
                name: "PriestNotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FamilyId = table.Column<Guid>(type: "uuid", nullable: true),
                    MemberId = table.Column<Guid>(type: "uuid", nullable: true),
                    EncryptedContent = table.Column<string>(type: "text", nullable: false),
                    Iv = table.Column<string>(type: "text", nullable: true),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table => { table.PrimaryKey("PK_PriestNotes", x => x.Id); table.ForeignKey("FK_PriestNotes_Families_FamilyId", x => x.FamilyId, "Families", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_PriestNotes_FamilyMembers_MemberId", x => x.MemberId, "FamilyMembers", "Id", onDelete: ReferentialAction.Cascade); });

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    PerformedBy = table.Column<string>(type: "text", nullable: false),
                    Entity = table.Column<string>(type: "text", nullable: false),
                    EntityId = table.Column<string>(type: "text", nullable: false),
                    Details = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table => { table.PrimaryKey("PK_AuditLogs", x => x.Id); });

            // Indexes
            migrationBuilder.CreateIndex(name: "IX_Users_Username", table: "Users", column: "Username", unique: true);
            migrationBuilder.CreateIndex(name: "IX_Roles_Name", table: "Roles", column: "Name", unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "AuditLogs");
            migrationBuilder.DropTable(name: "PriestNotes");
            migrationBuilder.DropTable(name: "FamilyMembers");
            migrationBuilder.DropTable(name: "Users");
            migrationBuilder.DropTable(name: "Families");
            migrationBuilder.DropTable(name: "Roles");
        }
    }
}
