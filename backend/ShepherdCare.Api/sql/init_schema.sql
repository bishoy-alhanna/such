-- ShepherdCare initial schema for PostgreSQL
-- Enables uuid-ossp for uuid generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Roles
CREATE TABLE IF NOT EXISTS "Roles" (
  "Id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "Name" varchar(200) NOT NULL UNIQUE,
  "Description" text
);

-- Users
CREATE TABLE IF NOT EXISTS "Users" (
  "Id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "Username" varchar(200) NOT NULL UNIQUE,
  "PasswordHash" varchar(500) NOT NULL,
  "DisplayName" varchar(300),
  "RoleId" uuid REFERENCES "Roles"("Id") ON DELETE SET NULL,
  "IsActive" boolean NOT NULL DEFAULT true,
  "CreatedAt" timestamptz NOT NULL DEFAULT now()
);

-- Families
CREATE TABLE IF NOT EXISTS "Families" (
  "Id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "FamilyName" varchar(300) NOT NULL,
  "Address" text,
  "Area" varchar(200),
  "PhoneNumbers" varchar(500),
  "AssignedPriestId" uuid,
  "Status" varchar(100)
);

-- FamilyMembers
CREATE TABLE IF NOT EXISTS "FamilyMembers" (
  "Id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "FamilyId" uuid NOT NULL REFERENCES "Families"("Id") ON DELETE CASCADE,
  "FullName" varchar(300) NOT NULL,
  "Gender" varchar(50),
  "DateOfBirth" date,
  "Relation" varchar(100),
  "Mobile" varchar(50),
  "IsChild" boolean NOT NULL DEFAULT false,
  "Notes" text
);

-- PriestNotes
CREATE TABLE IF NOT EXISTS "PriestNotes" (
  "Id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "FamilyId" uuid REFERENCES "Families"("Id") ON DELETE CASCADE,
  "MemberId" uuid REFERENCES "FamilyMembers"("Id") ON DELETE CASCADE,
  "EncryptedContent" text NOT NULL,
  "Iv" varchar(200),
  "CreatedById" uuid NOT NULL,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  "UpdatedById" uuid,
  "UpdatedAt" timestamptz
);

-- Visits
CREATE TABLE IF NOT EXISTS "Visits" (
  "Id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "FamilyId" uuid NOT NULL REFERENCES "Families"("Id") ON DELETE CASCADE,
  "PerformedById" uuid NOT NULL,
  "VisitDate" timestamptz NOT NULL,
  "VisitType" varchar(200),
  "Outcome" text,
  "NextActionDate" timestamptz,
  "FollowUpRequired" boolean NOT NULL DEFAULT false
);

-- Services
CREATE TABLE IF NOT EXISTS "Services" (
  "Id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "ServiceName" varchar(300) NOT NULL,
  "ServiceLeaderId" uuid,
  "Description" text
);

-- Classes
CREATE TABLE IF NOT EXISTS "Classes" (
  "Id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "ClassName" varchar(300) NOT NULL,
  "AgeGroup" varchar(200),
  "ServiceId" uuid NOT NULL REFERENCES "Services"("Id") ON DELETE CASCADE,
  "ClassLeaderId" uuid
);

-- Servants
CREATE TABLE IF NOT EXISTS "Servants" (
  "Id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "ClassId" uuid NOT NULL REFERENCES "Classes"("Id") ON DELETE CASCADE,
  "UserId" uuid NOT NULL
);

-- ClassEnrollments
CREATE TABLE IF NOT EXISTS "ClassEnrollments" (
  "Id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "ClassId" uuid NOT NULL REFERENCES "Classes"("Id") ON DELETE CASCADE,
  "MemberId" uuid NOT NULL REFERENCES "FamilyMembers"("Id") ON DELETE CASCADE,
  "AcademicYear" varchar(50) NOT NULL
);

-- AttendanceRecords
CREATE TABLE IF NOT EXISTS "AttendanceRecords" (
  "Id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "MemberId" uuid NOT NULL REFERENCES "FamilyMembers"("Id") ON DELETE CASCADE,
  "Date" timestamptz NOT NULL,
  "AttendanceType" varchar(100) NOT NULL,
  "ClassId" uuid,
  "RecordedById" uuid NOT NULL,
  "Notes" text
);

-- AuditLogs
CREATE TABLE IF NOT EXISTS "AuditLogs" (
  "Id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "Timestamp" timestamptz NOT NULL DEFAULT now(),
  "Action" varchar(200) NOT NULL,
  "PerformedBy" varchar(300) NOT NULL,
  "Entity" varchar(200) NOT NULL,
  "EntityId" varchar(200),
  "Details" text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON "AttendanceRecords" ("MemberId", "Date");
CREATE INDEX IF NOT EXISTS idx_visits_family_visitdate ON "Visits" ("FamilyId", "VisitDate");
