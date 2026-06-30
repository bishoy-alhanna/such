using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using ShepherdCare.Api.Data;

namespace ShepherdCare.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    partial class ShepherdCareModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
            modelBuilder.HasAnnotation("ProductVersion", "8.0.0");

            modelBuilder.Entity("ShepherdCare.Api.Models.Role", b =>
            {
                b.Property<Guid>("Id");
                b.Property<string>("Description");
                b.Property<string>("Name");
                b.HasKey("Id");
                b.HasIndex("Name").IsUnique();
                b.ToTable("Roles");
            });

            modelBuilder.Entity("ShepherdCare.Api.Models.Family", b =>
            {
                b.Property<Guid>("Id");
                b.Property<string>("FamilyName");
                b.Property<string>("Address");
                b.Property<string>("Area");
                b.Property<string>("PhoneNumbers");
                b.Property<Guid?>("AssignedPriestId");
                b.Property<string>("Status");
                b.HasKey("Id");
                b.ToTable("Families");
            });

            modelBuilder.Entity("ShepherdCare.Api.Models.User", b =>
            {
                b.Property<Guid>("Id");
                b.Property<string>("Username");
                b.Property<string>("PasswordHash");
                b.Property<string>("DisplayName");
                b.Property<Guid>("RoleId");
                b.Property<bool>("IsActive");
                b.Property<DateTime>("CreatedAt");
                b.HasKey("Id");
                b.HasIndex("Username").IsUnique();
                b.ToTable("Users");
            });

            modelBuilder.Entity("ShepherdCare.Api.Models.FamilyMember", b =>
            {
                b.Property<Guid>("Id");
                b.Property<Guid>("FamilyId");
                b.Property<string>("FullName");
                b.Property<string>("Gender");
                b.Property<DateTime?>("DateOfBirth");
                b.Property<string>("Relation");
                b.Property<string>("Mobile");
                b.Property<bool>("IsChild");
                b.Property<string>("Notes");
                b.Property<string>("NationalId");
                b.Property<DateTime>("CreatedAt")
                    .HasDefaultValueSql("NOW()");
                b.HasKey("Id");
                b.HasIndex("FamilyId");
                b.ToTable("FamilyMembers");
            });

            modelBuilder.Entity("ShepherdCare.Api.Models.PriestNote", b =>
            {
                b.Property<Guid>("Id");
                b.Property<Guid?>("FamilyId");
                b.Property<Guid?>("MemberId");
                b.Property<string>("EncryptedContent");
                b.Property<string>("Iv");
                b.Property<Guid>("CreatedById");
                b.Property<DateTime>("CreatedAt");
                b.Property<Guid?>("UpdatedById");
                b.Property<DateTime?>("UpdatedAt");
                b.HasKey("Id");
                b.HasIndex("FamilyId");
                b.HasIndex("MemberId");
                b.ToTable("PriestNotes");
            });

            modelBuilder.Entity("ShepherdCare.Api.Models.AuditLog", b =>
            {
                b.Property<Guid>("Id");
                b.Property<DateTime>("Timestamp");
                b.Property<string>("Action");
                b.Property<string>("PerformedBy");
                b.Property<string>("Entity");
                b.Property<string>("EntityId");
                b.Property<string>("Details");
                b.HasKey("Id");
                b.ToTable("AuditLogs");
            });

            modelBuilder.Entity("ShepherdCare.Api.Models.ScoreCategory", b =>
            {
                b.Property<Guid>("Id");
                b.Property<string>("Name");
                b.Property<string>("Description");
                b.Property<int>("MaxScore").HasDefaultValue(100);
                b.Property<bool>("IsPredefined").HasDefaultValue(false);
                b.Property<bool>("IsActive").HasDefaultValue(true);
                b.Property<Guid>("CreatedById");
                b.Property<DateTime>("CreatedAt").HasDefaultValueSql("NOW()");
                b.HasKey("Id");
                b.ToTable("ScoreCategories");
            });

            modelBuilder.Entity("ShepherdCare.Api.Models.ScoreEntry", b =>
            {
                b.Property<Guid>("Id");
                b.Property<Guid>("MemberId");
                b.Property<Guid>("CategoryId");
                b.Property<int>("ScoreValue");
                b.Property<DateTime>("Date");
                b.Property<string>("Description");
                b.Property<Guid>("RecordedById");
                b.Property<DateTime>("CreatedAt").HasDefaultValueSql("NOW()");
                b.HasKey("Id");
                b.HasIndex("MemberId");
                b.HasIndex("CategoryId");
                b.ToTable("ScoreEntries");
            });
        }
    }
}
