export interface Role {
  id: string
  name: string
  description?: string
}

export interface UserDto {
  id: string
  username: string
  displayName?: string
  roleId: string
  email?: string
}

export interface PagedResponse<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface Member {
  id: string
  primaryMemberId?: string
  familyId: string
  fullName: string
  gender?: string
  dateOfBirth?: string
  relation?: string
  mobile?: string
  isChild: boolean
  notes?: string
  nationalId?: string
  // Education / Work
  occupationStatus?: string
  studyYear?: string
  college?: string
  jobTitle?: string
  jobDetails?: string
  qualification?: string
  // Church
  church?: string
  meetingAttended?: string
  confessionFather?: string
  lastConfessionDate?: string
  lastCommunionDate?: string
  lastCallDate?: string
  // Coptic identity
  baptismName?: string
  nameDayMonth?: number
  nameDayDay?: number
  // Service
  isServant: boolean
  serviceType?: string
  // Misc
  status?: string
  photoUrl?: string
  createdAt?: string
}

export interface Family {
  id: string
  familyName: string
  address?: string
  area?: string
  phoneNumbers?: string
  status?: string
  assignedPriestId?: string
  latitude?: number
  longitude?: number
  members?: Member[]
}

export interface Visit {
  id: string
  familyId: string
  performedById: string
  visitDate: string
  visitType?: string
  outcome?: string
  followUpRequired: boolean
  nextActionDate?: string
}

export interface ClassItem {
  id: string
  className: string
  ageGroup?: string
  serviceId: string
  classLeaderId?: string
}

export interface AttendanceRecord {
  id: string
  memberId: string
  date: string
  attendanceType: string
  classId?: string
  recordedById: string
  notes?: string
}

export interface PriestNote {
  id: string
  content: string
  familyId?: string
  memberId?: string
  createdAt: string
}

export interface Visit {
  id: string
  familyId: string
  performedById: string
  visitDate: string
  visitType?: string
  outcome?: string
  followUpRequired: boolean
  nextActionDate?: string
}

export interface ClassItem {
  id: string
  className: string
  ageGroup?: string
  serviceId: string
  classLeaderId?: string
}

export interface AttendanceRecord {
  id: string
  memberId: string
  date: string
  attendanceType: string
  classId?: string
  recordedById: string
  notes?: string
}
