using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShepherdCare.Api.Migrations
{
    public partial class AddCreatedAtToFamilyMember : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add NationalId if it doesn't already exist (it may have been added manually)
            migrationBuilder.Sql(@"
                ALTER TABLE ""FamilyMembers""
                ADD COLUMN IF NOT EXISTS ""NationalId"" text NULL;
            ");

            // Add CreatedAt with a default of NOW() for all existing rows
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "FamilyMembers",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "NOW()");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "CreatedAt", table: "FamilyMembers");
            migrationBuilder.DropColumn(name: "NationalId", table: "FamilyMembers");
        }
    }
}
