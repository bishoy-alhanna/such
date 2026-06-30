using System;
using System.Collections.Generic;

namespace ShepherdCare.Api.Models
{
    public class FamilyMember
    {
        public Guid Id { get; set; }
        public Guid FamilyId { get; set; }
        public Family? Family { get; set; }

        // ── Core ──────────────────────────────────────────────────
        public string FullName { get; set; } = string.Empty;
        public string? Gender { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? Mobile { get; set; }
        public string? Relation { get; set; }          // نوع الفرد
        public bool IsChild { get; set; }
        /// <summary>Egyptian National ID — 14 digits</summary>
        public string? NationalId { get; set; }

        // ── Education / Work ──────────────────────────────────────
        /// <summary>Student / Working / Other — طالب / يعمل</summary>
        public string? OccupationStatus { get; set; }
        public string? StudyYear { get; set; }         // سنة الدراسة
        public string? College { get; set; }           // الكلية
        public string? JobTitle { get; set; }          // الوظيفة
        public string? JobDetails { get; set; }        // تفاصيل الوظيفة
        public string? Qualification { get; set; }     // المؤهل

        // ── Church ────────────────────────────────────────────────
        public string? Church { get; set; }            // الكنيسة
        public string? MeetingAttended { get; set; }   // الاجتماع المشارك به
        public string? ConfessionFather { get; set; }  // اب الاعتراف
        public DateTime? LastConfessionDate { get; set; }  // تاريخ اخر اعتراف
        public DateTime? LastCommunionDate { get; set; }   // تاريخ اخر تناول
        public DateTime? LastCallDate { get; set; }        // تاريخ اخر مكالمة

        // ── Service ───────────────────────────────────────────────
        public bool IsServant { get; set; }            // خادم أو لا
        public string? ServiceType { get; set; }       // نوع الخدمة

        // ── Coptic identity ───────────────────────────────────────
        public string? BaptismName { get; set; }       // الاسم القبطي / اسم التعميد
        public int? NameDayMonth { get; set; }         // شهر عيد الاسم (1-12)
        public int? NameDayDay { get; set; }           // يوم عيد الاسم

        // ── Misc ──────────────────────────────────────────────────
        public string? Status { get; set; }            // الحالة
        public string? Notes { get; set; }             // ملاحظات
        public string? PhotoUrl { get; set; }          // صورة
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<PriestNote> PriestNotes { get; set; } = new();
    }
}
