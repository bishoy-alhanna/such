using Microsoft.EntityFrameworkCore;
using ShepherdCare.Api.Models;

namespace ShepherdCare.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users => Set<User>();
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<Family> Families => Set<Family>();
        public DbSet<FamilyMember> FamilyMembers => Set<FamilyMember>();
        public DbSet<PriestNote> PriestNotes => Set<PriestNote>();
        public DbSet<Visit> Visits => Set<Visit>();
        public DbSet<Service> Services => Set<Service>();
        public DbSet<Class> Classes => Set<Class>();
        public DbSet<Servant> Servants => Set<Servant>();
        public DbSet<ClassEnrollment> ClassEnrollments => Set<ClassEnrollment>();
        public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
        public DbSet<Area> Areas => Set<Area>();
        public DbSet<Street> Streets => Set<Street>();
        public DbSet<Building> Buildings => Set<Building>();
        public DbSet<Group> Groups => Set<Group>();
        public DbSet<FamilyLink> FamilyLinks => Set<FamilyLink>();
        public DbSet<SpiritualRecord> SpiritualRecords => Set<SpiritualRecord>();
        public DbSet<ScoreCategory> ScoreCategories => Set<ScoreCategory>();
        public DbSet<ScoreEntry> ScoreEntries => Set<ScoreEntry>();
        public DbSet<PendingScore> PendingScores => Set<PendingScore>();
        public DbSet<PendingMemberUpdate> PendingMemberUpdates => Set<PendingMemberUpdate>();
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<SacramentalMilestone> SacramentalMilestones => Set<SacramentalMilestone>();
        public DbSet<Event> Events => Set<Event>();
        public DbSet<EventAttendance> EventAttendances => Set<EventAttendance>();
        public DbSet<FollowUpTask> FollowUpTasks => Set<FollowUpTask>();
        public DbSet<GivingRecord> GivingRecords => Set<GivingRecord>();
        public DbSet<Pledge> Pledges => Set<Pledge>();
        public DbSet<VolunteerAssignment> VolunteerAssignments => Set<VolunteerAssignment>();
        public DbSet<ServiceHours> ServiceHours => Set<ServiceHours>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>().HasIndex(u => u.Username).IsUnique();
            modelBuilder.Entity<Role>().HasIndex(r => r.Name).IsUnique();

            // Relationships
            modelBuilder.Entity<FamilyMember>()
                .HasOne(m => m.Family)
                .WithMany(f => f.Members)
                .HasForeignKey(m => m.FamilyId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PriestNote>()
                .HasOne(n => n.Family)
                .WithMany(f => f.PriestNotes)
                .HasForeignKey(n => n.FamilyId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PriestNote>()
                .HasOne(n => n.Member)
                .WithMany(m => m.PriestNotes)
                .HasForeignKey(n => n.MemberId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<Area>().HasIndex(a => a.Name).IsUnique();

            modelBuilder.Entity<Street>()
                .HasOne(s => s.Area)
                .WithMany(a => a.Streets)
                .HasForeignKey(s => s.AreaId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Building>()
                .HasOne(b => b.Street)
                .WithMany(s => s.Buildings)
                .HasForeignKey(b => b.StreetId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Group>()
                .HasMany(g => g.Classes)
                .WithOne(c => c.Group)
                .HasForeignKey(c => c.GroupId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Servant>()
                .HasOne(s => s.Class)
                .WithMany(c => c.Servants)
                .HasForeignKey(s => s.ClassId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ClassEnrollment>()
                .HasOne(e => e.Class)
                .WithMany(c => c.ClassEnrollments)
                .HasForeignKey(e => e.ClassId)
                .OnDelete(DeleteBehavior.Cascade);

            // FamilyLink: two FKs to Family, no cascade (manual delete only)
            modelBuilder.Entity<FamilyLink>()
                .HasOne(l => l.Family)
                .WithMany(f => f.FamilyLinks)
                .HasForeignKey(l => l.FamilyId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<FamilyLink>()
                .HasOne(l => l.LinkedFamily)
                .WithMany()
                .HasForeignKey(l => l.LinkedFamilyId)
                .OnDelete(DeleteBehavior.Restrict);

            // Visit relationships
            modelBuilder.Entity<Visit>()
                .HasOne(v => v.Family)
                .WithMany()
                .HasForeignKey(v => v.FamilyId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Visit>()
                .HasOne(v => v.Member)
                .WithMany()
                .HasForeignKey(v => v.MemberId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Visit>()
                .HasOne(v => v.VisitorUser)
                .WithMany()
                .HasForeignKey(v => v.VisitorUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ScoreEntry>()
                .HasOne(e => e.Member)
                .WithMany()
                .HasForeignKey(e => e.MemberId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ScoreEntry>()
                .HasOne(e => e.Category)
                .WithMany()
                .HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ScoreEntry>()
                .HasOne(e => e.RecordedByUser)
                .WithMany()
                .HasForeignKey(e => e.RecordedById)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PendingScore>()
                .HasOne(p => p.Member).WithMany().HasForeignKey(p => p.MemberId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<PendingScore>()
                .HasOne(p => p.Category).WithMany().HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<PendingScore>()
                .HasOne(p => p.SubmittedBy).WithMany().HasForeignKey(p => p.SubmittedById).OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PendingMemberUpdate>()
                .HasOne(p => p.Member).WithMany().HasForeignKey(p => p.MemberId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<PendingMemberUpdate>()
                .HasOne(p => p.SubmittedBy).WithMany().HasForeignKey(p => p.SubmittedById).OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Notification>()
                .HasOne(n => n.User).WithMany().HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SacramentalMilestone>()
                .HasOne(m => m.Member).WithMany().HasForeignKey(m => m.MemberId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<SacramentalMilestone>()
                .HasOne(m => m.RecordedByUser).WithMany().HasForeignKey(m => m.RecordedById).OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Event>()
                .HasOne(e => e.CreatedByUser).WithMany().HasForeignKey(e => e.CreatedById).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Event>()
                .HasOne(e => e.Class).WithMany().HasForeignKey(e => e.ClassId).OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<Event>()
                .HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId).OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<EventAttendance>()
                .HasOne(a => a.Event).WithMany(e => e.Attendances).HasForeignKey(a => a.EventId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<EventAttendance>()
                .HasOne(a => a.Member).WithMany().HasForeignKey(a => a.MemberId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<EventAttendance>()
                .HasOne(a => a.MarkedByUser).WithMany().HasForeignKey(a => a.MarkedById).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<EventAttendance>()
                .HasIndex(a => new { a.EventId, a.MemberId }).IsUnique();

            modelBuilder.Entity<FollowUpTask>()
                .HasOne(t => t.AssignedToUser).WithMany().HasForeignKey(t => t.AssignedToUserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<FollowUpTask>()
                .HasOne(t => t.RelatedMember).WithMany().HasForeignKey(t => t.RelatedMemberId).OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<FollowUpTask>()
                .HasOne(t => t.RelatedVisit).WithMany().HasForeignKey(t => t.RelatedVisitId).OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<FollowUpTask>()
                .HasOne(t => t.CreatedByUser).WithMany().HasForeignKey(t => t.CreatedById).OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<GivingRecord>()
                .HasOne(g => g.Family).WithMany().HasForeignKey(g => g.FamilyId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<GivingRecord>()
                .HasOne(g => g.RecordedByUser).WithMany().HasForeignKey(g => g.RecordedById).OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Pledge>()
                .HasOne(p => p.Family).WithMany().HasForeignKey(p => p.FamilyId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<Pledge>()
                .HasOne(p => p.CreatedByUser).WithMany().HasForeignKey(p => p.CreatedById).OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<VolunteerAssignment>()
                .HasOne(v => v.Member).WithMany().HasForeignKey(v => v.MemberId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<VolunteerAssignment>()
                .HasOne(v => v.Event).WithMany().HasForeignKey(v => v.EventId).OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<VolunteerAssignment>()
                .HasOne(v => v.CreatedByUser).WithMany().HasForeignKey(v => v.CreatedById).OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ServiceHours>()
                .HasOne(s => s.Member).WithMany().HasForeignKey(s => s.MemberId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<ServiceHours>()
                .HasOne(s => s.RecordedByUser).WithMany().HasForeignKey(s => s.RecordedById).OnDelete(DeleteBehavior.Restrict);
        }
    }
}