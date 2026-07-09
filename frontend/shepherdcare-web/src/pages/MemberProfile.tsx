import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../services/api'
import Header from '../components/Header'
import MemberFormModal from '../components/MemberFormModal'
import QRCodeDisplay from '../components/QRCodeDisplay'
import { useAuth } from '../auth'
import { useT } from '../i18n'
import type { Member } from '../types'
import { formatAge, formatServiceAge, sep15RefYear } from '../utils/ageDisplay'

interface ServantAssignment { id: string; classId: string; className: string }
interface ServantInfo { username: string | null; userId: string | null; assignments: ServantAssignment[] }

interface SpiritualRecord {
  id: string
  memberId: string
  type: 'Confession' | 'Communion' | 'Mass' | 'Call'
  date: string
  notes?: string
  createdAt: string
  recordedByName?: string
}

interface AttendanceRecord {
  id: string
  memberId: string
  attendanceType: 'SundaySchool' | 'Mass' | 'Communion' | 'Confession'
  date: string
  classId?: string
  notes?: string
}

interface Milestone {
  id: string
  memberId: string
  type: string
  date: string
  notes?: string
  recordedByName?: string
}

const MILESTONE_ICONS: Record<string, string> = {
  Baptism: '💧', Chrismation: '🕊️', FirstCommunion: '🍷', FirstConfession: '✝️',
  Wedding: '💍', Ordination: '👐', Tonsure: '✂️', Consecration: '🕌', Other: '⭐',
}
const MILESTONE_VALS = ['Baptism','Chrismation','FirstCommunion','FirstConfession','Wedding','Ordination','Tonsure','Consecration','Other'] as const

function fmt(date?: string) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('ar-EG')
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#374151' }}>{title}</h3>
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '6px 12px', padding: '6px 0', borderBottom: '1px solid #f9fafb' }}>
      <span style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.9rem', fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  )
}

function DateChip({ label, date }: { label: string; date?: string }) {
  const { t } = useT()
  const weeksAgo = date ? Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24 * 7)) : null
  const isOld = weeksAgo !== null && weeksAgo > 8
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 10,
      background: isOld ? '#fee2e2' : '#f0fdf4',
      border: `1px solid ${isOld ? '#fca5a5' : '#86efac'}`,
      flex: 1, minWidth: 140
    }}>
      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: isOld ? '#dc2626' : '#166534' }}>
        {date ? fmt(date) : '—'}
      </div>
      {weeksAgo !== null && (
        <div style={{ fontSize: '11px', color: isOld ? '#ef4444' : '#4ade80', marginTop: 2 }}>
          {t('memberProfile.weeksAgo' as any, { n: weeksAgo })}
        </div>
      )}
    </div>
  )
}

function lastDate(records: { date: string }[]) {
  return records.length > 0 ? records[0].date : undefined
}

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { t } = useT()
  const canManageServants = ['SuperAdmin', 'Priest', 'SeniorPriest'].includes(user?.role ?? '')
  const canManageUsers    = ['SuperAdmin', 'Priest', 'SeniorPriest', 'ServiceLeader'].includes(user?.role ?? '')
  const isMember          = user?.role === 'Member'
  const isSelf            = !!user?.familyMemberId && user.familyMemberId === id

  const milestoneTypes = MILESTONE_VALS.map(v => ({ value: v, label: (t as any)(`milestone.${v}`) as string, icon: MILESTONE_ICONS[v] }))
  const milestoneMap = Object.fromEntries(milestoneTypes.map(m => [m.value, m]))
  const relLabel = (rel: string) => ((t as any)(`rel.${rel}`) as string) || rel
  const occLabel = (occ: string) => ({ Student: t('members.student'), Working: t('members.working'), Both: t('members.studentAndWorking'), Neither: t('members.neither') }[occ] ?? occ)
  const qualLabel = (q: string) => ({ Primary: t('members.qualPrimary'), Preparatory: t('members.qualPreparatory'), Secondary: t('members.qualSecondary'), Diploma: t('members.qualDiploma'), Bachelor: t('members.qualBachelor'), Masters: t('members.qualMaster'), PhD: t('members.qualPhd') }[q] ?? q)

  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  const [spiritualRecords, setSpiritualRecords] = useState<SpiritualRecord[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])

  // milestone add-form state
  const [msType, setMsType]       = useState('Baptism')
  const [msDate, setMsDate]       = useState('')
  const [msNote, setMsNote]       = useState('')
  const [msAdding, setMsAdding]   = useState(false)
  const [msFormOpen, setMsFormOpen] = useState(false)

  const [servantInfo, setServantInfo] = useState<ServantInfo | null>(null)
  const [classQuery, setClassQuery] = useState('')
  const [classSuggestions, setClassSuggestions] = useState<{ id: string; className: string }[]>([])
  const [addingClass, setAddingClass] = useState(false)
  const [showQR, setShowQR] = useState(false)

  // Self-edit (member viewing own profile)
  const [selfEditOpen, setSelfEditOpen]     = useState(false)
  const [selfForm, setSelfForm]             = useState<Record<string, string>>({})
  const [selfSaving, setSelfSaving]         = useState(false)
  const [selfSaved, setSelfSaved]           = useState(false)
  const [pendingUpdate, setPendingUpdate]   = useState<{ status: string; submittedAt: string; reviewNote?: string } | null>(null)

  // User-linking state (admin only)
  const [linkUsername, setLinkUsername] = useState('')
  const [linking, setLinking] = useState(false)
  const [linkErr, setLinkErr] = useState('')

  const [scoreHistory, setScoreHistory] = useState<{ month: string; total: number }[]>([])

  useEffect(() => {
    if (!id) return
    api.get<Member>(`/members/${id}`)
      .then(r => { setMember(r.data); setSelfForm(r.data as unknown as Record<string, string>) })
      .catch(() => setMember(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!isSelf) return
    api.get('/members/me/pending-update')
      .then(r => { if (r.data) setPendingUpdate(r.data) })
      .catch(() => {})
  }, [isSelf])

  useEffect(() => {
    if (!id) return
    api.get<SpiritualRecord[]>(`/spiritual-records/by-member/${id}`)
      .then(r => setSpiritualRecords(r.data))
      .catch(() => setSpiritualRecords([]))
    api.get<AttendanceRecord[]>(`/attendance/by-member/${id}`)
      .then(r => setAttendanceRecords(r.data))
      .catch(() => setAttendanceRecords([]))
    api.get<Milestone[]>(`/members/${id}/milestones`)
      .then(r => setMilestones(r.data))
      .catch(() => setMilestones([]))
    api.get<{ items: { scoreValue: number; date: string }[] }>(`/scores?memberId=${id}&pageSize=200`)
      .then(r => {
        const map: Record<string, number> = {}
        for (const e of r.data.items ?? []) {
          const m = e.date.substring(0, 7)
          map[m] = (map[m] ?? 0) + e.scoreValue
        }
        const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }))
        setScoreHistory(sorted)
      })
      .catch(() => setScoreHistory([]))
  }, [id])

  const addMilestone = async () => {
    if (!msDate || msAdding) return
    setMsAdding(true)
    try {
      const res = await api.post<Milestone>(`/members/${id}/milestones`, { type: msType, date: msDate, notes: msNote || undefined })
      setMilestones(prev => [...prev, res.data].sort((a, b) => a.date.localeCompare(b.date)))
      setMsFormOpen(false)
      setMsDate(''); setMsNote('')
    } catch (e: any) {
      alert(e?.response?.data?.message || t('memberProfile.errorSaving' as any))
    }
    setMsAdding(false)
  }

  const deleteMilestone = async (msId: string) => {
    if (!confirm(t('memberProfile.confirmDeleteMilestone' as any))) return
    try {
      await api.delete(`/milestones/${msId}`)
      setMilestones(prev => prev.filter(m => m.id !== msId))
    } catch { alert(t('memberProfile.errorDeleting' as any)) }
  }

  const submitSelfEdit = async () => {
    setSelfSaving(true)
    try {
      await api.post('/members/me/request-update', {
        mobile:           selfForm.mobile           || null,
        gender:           selfForm.gender           || null,
        dateOfBirth:      selfForm.dateOfBirth      || null,
        occupationStatus: selfForm.occupationStatus || null,
        studyYear:        selfForm.studyYear        || null,
        college:          selfForm.college          || null,
        jobTitle:         selfForm.jobTitle         || null,
        jobDetails:       selfForm.jobDetails       || null,
        qualification:    selfForm.qualification    || null,
        church:           selfForm.church           || null,
        meetingAttended:  selfForm.meetingAttended  || null,
        confessionFather: selfForm.confessionFather || null,
        notes:            selfForm.notes            || null,
      })
      setSelfEditOpen(false)
      setSelfSaved(true)
      const r = await api.get('/members/me/pending-update')
      if (r.data) setPendingUpdate(r.data)
    } catch { alert(t('memberProfile.errorSendingRequest' as any)) }
    finally { setSelfSaving(false) }
  }

  const fetchServantInfo = () => {
    if (!id) return
    api.get<ServantInfo>(`/members/${id}/servant-assignments`)
      .then(r => setServantInfo(r.data))
      .catch(() => setServantInfo(null))
  }

  useEffect(() => {
    if (member?.isServant || canManageUsers) fetchServantInfo()
  }, [member?.isServant, id])

  useEffect(() => {
    if (classQuery.length < 2) { setClassSuggestions([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await api.get<any>('/classes', { params: { q: classQuery, pageSize: 8 } })
        setClassSuggestions(res.data.items ?? res.data ?? [])
      } catch { setClassSuggestions([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [classQuery])

  const addClassAssignment = async (classId: string) => {
    setAddingClass(true)
    try {
      await api.post(`/members/${id}/servant-assignments`, { classId })
      setClassQuery('')
      setClassSuggestions([])
      fetchServantInfo()
    } catch { alert(t('memberProfile.errorAddingClass' as any)) }
    setAddingClass(false)
  }

  const removeClassAssignment = async (assignmentId: string) => {
    try {
      await api.delete(`/members/${id}/servant-assignments/${assignmentId}`)
      fetchServantInfo()
    } catch { alert(t('memberProfile.errorRemovingClass' as any)) }
  }

  const linkUser = async () => {
    if (!linkUsername.trim() || linking) return
    setLinking(true); setLinkErr('')
    try {
      await api.post(`/members/${id}/link-user`, { username: linkUsername.trim() })
      setLinkUsername('')
      fetchServantInfo()
    } catch (e: any) {
      setLinkErr(e?.response?.data?.message || t('memberProfile.errorLinkUser' as any))
    }
    setLinking(false)
  }

  const unlinkUser = async () => {
    if (!confirm(t('memberProfile.confirmUnlinkUser' as any))) return
    try {
      await api.delete(`/members/${id}/link-user`)
      fetchServantInfo()
    } catch { alert(t('memberProfile.errorUnlinkUser' as any)) }
  }

  if (loading) return (
    <div><Header />
      <div className="container">
        <p style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>{t('memberProfile.loading' as any)}</p>
      </div>
    </div>
  )

  if (!member) return (
    <div><Header />
      <div className="container">
        <p style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>{t('memberProfile.notFound' as any)}</p>
      </div>
    </div>
  )

  const photoSrc = member.photoUrl || null

  const memberAge = formatAge(member.dateOfBirth)
  const memberServiceAge = formatServiceAge(member.dateOfBirth)

  return (
    <div>
      <Header />
      <div className="container" style={{ maxWidth: 760 }}>

        {/* Back link */}
        {member.familyId && (
          <div style={{ marginBottom: 16 }}>
            <Link to={`/families/${member.familyId}`} style={{ color: '#6b7280', fontSize: '0.88rem', textDecoration: 'none' }}>
              {t('memberProfile.backToFamily' as any)}
            </Link>
          </div>
        )}

        {/* Hero card */}
        <div style={{
          background: 'white', border: '1px solid #e5e7eb', borderRadius: 16,
          padding: '24px', marginBottom: 20, display: 'flex', gap: 24, alignItems: 'flex-start'
        }}>
          {/* Avatar */}
          <div style={{
            width: 110, height: 110, borderRadius: 16, flexShrink: 0,
            background: '#f1f5f9', border: '3px solid #e5e7eb',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {photoSrc
              ? <img src={photoSrc} alt={member.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 48, color: '#d1d5db' }}>{member.gender === 'Female' ? '👩' : '👤'}</span>
            }
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{member.fullName}</h1>
              {member.isServant && (
                <span style={{ padding: '2px 10px', background: '#ede9fe', color: '#6d28d9', borderRadius: 20, fontSize: '12px', fontWeight: 700 }}>✝️ {t('memberProfile.servant' as any)}</span>
              )}
              {member.status && (
                <span style={{ padding: '2px 10px', background: '#f0fdf4', color: '#166534', borderRadius: 20, fontSize: '12px', fontWeight: 600 }}>{member.status}</span>
              )}
            </div>

            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: '0.88rem', color: '#6b7280' }}>
              {member.relation && <span>👥 {relLabel(member.relation)}</span>}
              {member.gender && <span>{member.gender === 'Male' ? `♂ ${t('members.genderMale')}` : `♀ ${t('members.genderFemale')}`}</span>}
              {member.dateOfBirth && (
                <span>
                  🎂 {memberAge} <span style={{ color: '#94a3b8', fontSize: '0.82em' }}>({fmt(member.dateOfBirth)})</span>
                  <span style={{ marginLeft: 8, color: '#6366f1', fontSize: '0.85em', fontWeight: 600 }}>
                    {t('memberProfile.serviceAge' as any, { age: memberServiceAge })} <span style={{ fontWeight: 400, color: '#94a3b8' }}>(Sep {sep15RefYear()})</span>
                  </span>
                </span>
              )}
              {member.isChild && <span>👶 {t('memberProfile.child' as any)}</span>}
            </div>

            {/* Action buttons */}
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {member.mobile && (
                <a href={`tel:${member.mobile}`} style={{
                  padding: '6px 14px', background: '#dbeafe', color: '#1e40af',
                  borderRadius: 8, fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600
                }}>📞 {member.mobile}</a>
              )}
              {!isMember && (
                <button
                  onClick={() => setEditOpen(true)}
                  style={{
                    padding: '6px 16px', background: '#4f46e5', color: 'white',
                    borderRadius: 8, fontSize: '0.85rem', border: 'none', cursor: 'pointer', fontWeight: 600
                  }}>
                  {t('memberProfile.editProfileBtn' as any)}
                </button>
              )}
              {isSelf && (
                <button
                  onClick={() => { setSelfForm(member as unknown as Record<string, string>); setSelfEditOpen(true); setSelfSaved(false) }}
                  style={{
                    padding: '6px 16px', background: '#4f46e5', color: 'white',
                    borderRadius: 8, fontSize: '0.85rem', border: 'none', cursor: 'pointer', fontWeight: 600
                  }}>
                  {t('memberProfile.requestUpdateBtn' as any)}
                </button>
              )}
              {member.familyId ? (
                <Link to={`/families/${member.familyId}`} style={{
                  padding: '6px 14px', background: '#f1f5f9', color: '#374151',
                  borderRadius: 8, fontSize: '0.85rem', textDecoration: 'none'
                }}>👨‍👩‍👧 {t('memberProfile.viewFamily' as any)}</Link>
              ) : (
                <span style={{
                  padding: '6px 14px', background: '#fef3c7', color: '#92400e',
                  borderRadius: 8, fontSize: '0.85rem', fontWeight: 600
                }}>{t('memberProfile.noFamily' as any)}</span>
              )}
              <button onClick={() => setShowQR(v => !v)} style={{
                padding: '6px 14px', background: showQR ? '#6366f1' : '#f1f5f9',
                color: showQR ? '#fff' : '#374151',
                border: 'none', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600,
              }}>{showQR ? t('memberProfile.hideQR' as any) : t('memberProfile.showQR' as any)}</button>
            </div>

            {/* QR Code panel */}
            {showQR && (
              <div style={{ marginTop: 14, padding: '16px 20px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 12, display: 'inline-block' }}>
                <QRCodeDisplay value={member.id} size={160} label={t('memberProfile.qrIdentifier' as any, { name: member.fullName })} />
              </div>
            )}
          </div>
        </div>

        {/* Pending update / saved banners (self-view) */}
        {isSelf && pendingUpdate?.status === 'Pending' && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 16px', marginBottom: 14, color: '#92400e', fontSize: 14 }}>
            {t('memberProfile.pendingUpdateBanner' as any)}
          </div>
        )}
        {isSelf && selfSaved && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 16px', marginBottom: 14, color: '#15803d', fontSize: 14 }}>
            {t('memberProfile.updateSentBanner' as any)}
          </div>
        )}

        {/* Last-record summary chips */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, marginBottom: 6 }}>{t('memberProfile.lastSpiritual' as any)}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <DateChip label={t('memberProfile.lastConfession' as any)} date={lastDate(spiritualRecords.filter(r => r.type === 'Confession'))} />
            <DateChip label={t('memberProfile.lastCommunion' as any)}  date={lastDate(spiritualRecords.filter(r => r.type === 'Communion'))} />
            <DateChip label={t('memberProfile.lastMass' as any)}       date={lastDate(spiritualRecords.filter(r => r.type === 'Mass'))} />
            <DateChip label={t('memberProfile.lastCall' as any)}       date={lastDate(spiritualRecords.filter(r => r.type === 'Call'))} />
          </div>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, marginBottom: 6 }}>{t('memberProfile.lastAttendance' as any)}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <DateChip label={t('memberProfile.lastSundaySchool' as any)} date={lastDate(attendanceRecords.filter(r => r.attendanceType === 'SundaySchool'))} />
          </div>
        </div>

        {/* Coptic identity */}
        {(member.baptismName || member.nameDayMonth) && (
          <Section title={t('memberProfile.sectCopticName' as any)} icon="✝">
            <InfoRow label={t('memberProfile.copticName' as any)} value={member.baptismName} />
            {member.nameDayMonth && member.nameDayDay && (
              <InfoRow label={t('memberProfile.nameDay' as any)} value={`${member.nameDayDay}/${member.nameDayMonth}`} />
            )}
          </Section>
        )}

        {/* Church */}
        {(member.church || member.confessionFather || member.meetingAttended) && (
          <Section title={t('memberProfile.sectChurch' as any)} icon="⛪">
            <InfoRow label={t('memberProfile.churchLabel' as any)}           value={member.church} />
            <InfoRow label={t('memberProfile.confessionFatherLabel' as any)} value={member.confessionFather} />
            <InfoRow label={t('memberProfile.meetingLabel' as any)}          value={member.meetingAttended} />
          </Section>
        )}

        {/* Service + Servant assignments */}
        {member.isServant && (
          <Section title={t('memberProfile.sectService' as any)} icon="✝️">
            <InfoRow label={t('memberProfile.serviceTypeLabel' as any)} value={member.serviceType} />

            {/* Account info — visible to priests/admin only */}
            {canManageServants && servantInfo?.username && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: '0.85rem' }}>
                <span style={{ color: '#6b7280' }}>{t('memberProfile.systemAccount' as any)} </span>
                <strong style={{ fontFamily: 'monospace', color: '#1e40af' }}>{servantInfo.username}</strong>
              </div>
            )}

            {/* Class assignments */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 8 }}>{t('memberProfile.assignedClasses' as any)}</div>

              {(!servantInfo || servantInfo.assignments.length === 0) ? (
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 8px' }}>{t('memberProfile.noAssignedClasses' as any)}</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {servantInfo.assignments.map(a => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 20, fontSize: '0.83rem', fontWeight: 600,
                      background: '#f0fdf4', border: '1px solid #86efac', color: '#166534'
                    }}>
                      📚 {a.className}
                      {canManageServants && (
                        <button onClick={() => removeClassAssignment(a.id)} style={{
                          background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
                          fontSize: 14, padding: '0 2px', lineHeight: 1
                        }} title="إزالة">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add class — admin/priest only */}
              {canManageServants && (
                <div style={{ position: 'relative', maxWidth: 320 }}>
                  <input
                    type="text"
                    placeholder={t('memberProfile.assignClass' as any)}
                    value={classQuery}
                    onChange={e => setClassQuery(e.target.value)}
                    disabled={addingClass}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                  {classSuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                      background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 2
                    }}>
                      {classSuggestions.map((c: any) => (
                        <div key={c.id}
                          onClick={() => addClassAssignment(c.id)}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.88rem', borderBottom: '1px solid #f3f4f6' }}
                        >
                          {c.className}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Work / Education */}
        {(member.occupationStatus || member.qualification || member.college || member.jobTitle) && (
          <Section title={t('memberProfile.sectEducation' as any)} icon="🎓">
            <InfoRow label={t('memberProfile.occupationLabel' as any)}   value={member.occupationStatus ? occLabel(member.occupationStatus) : undefined} />
            <InfoRow label={t('memberProfile.qualificationLabel' as any)} value={member.qualification ? qualLabel(member.qualification) : undefined} />
            <InfoRow label={t('memberProfile.collegeLabel' as any)}      value={member.college} />
            <InfoRow label={t('memberProfile.studyYearLabel' as any)}    value={member.studyYear} />
            <InfoRow label={t('memberProfile.jobTitleLabel' as any)}     value={member.jobTitle} />
            <InfoRow label={t('memberProfile.jobDetailsLabel' as any)}   value={member.jobDetails} />
          </Section>
        )}

        {/* Other */}
        {(member.nationalId || member.notes) && (
          <Section title={t('memberProfile.sectOther' as any)} icon="📋">
            <InfoRow label={t('memberProfile.nationalIdLabel' as any)} value={member.nationalId} mono />
            <InfoRow label={t('memberProfile.notesLabel' as any)}      value={member.notes} />
          </Section>
        )}

        {/* Sacramental Milestones */}
        <Section title={t('memberProfile.sectMilestones' as any)} icon="⛪">
          {milestones.length === 0 && !msFormOpen && (
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 10px' }}>{t('memberProfile.noMilestones' as any)}</p>
          )}

          {/* Timeline */}
          {milestones.length > 0 && (
            <div style={{ position: 'relative', paddingInlineStart: 28, marginBottom: 16 }}>
              {/* vertical line */}
              <div style={{ position: 'absolute', insetInlineStart: 10, top: 0, bottom: 0, width: 2, background: '#e5e7eb', borderRadius: 2 }} />
              {milestones.map((ms, i) => {
                const meta = milestoneMap[ms.type] ?? { label: ms.type, icon: '⭐' }
                return (
                  <div key={ms.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, position: 'relative' }}>
                    {/* dot */}
                    <div style={{
                      position: 'absolute', insetInlineStart: -18, top: 4,
                      width: 16, height: 16, borderRadius: '50%',
                      background: '#6366f1', border: '2px solid #fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, boxShadow: '0 0 0 2px #e0e7ff',
                    }}>
                      <span style={{ fontSize: 8 }}>{meta.icon}</span>
                    </div>
                    {/* content */}
                    <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1f2937' }}>{meta.icon} {meta.label}</span>
                          <span style={{ marginInlineStart: 10, fontSize: '0.8rem', color: '#6b7280' }}>{fmt(ms.date)}</span>
                        </div>
                        {['SuperAdmin', 'Priest', 'SeniorPriest'].includes(user?.role ?? '') && (
                          <button
                            onClick={() => deleteMilestone(ms.id)}
                            style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}
                            title="حذف"
                          >✕</button>
                        )}
                      </div>
                      {ms.notes && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>{ms.notes}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add form — servants and above (not members) */}
          {!isMember && !msFormOpen && (
            <button
              onClick={() => setMsFormOpen(true)}
              style={{ background: '#f0f9ff', color: '#0369a1', border: '1px dashed #7dd3fc', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600 }}
            >
              {t('memberProfile.addMilestone' as any)}
            </button>
          )}

          {msFormOpen && (
            <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginTop: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('memberProfile.milestoneType' as any)}</label>
                  <select value={msType} onChange={e => setMsType(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }}>
                    {milestoneTypes.map(m => (
                      <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('memberProfile.milestoneDate' as any)}</label>
                  <input type="date" value={msDate} onChange={e => setMsDate(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('memberProfile.milestoneNote' as any)}</label>
                <input type="text" value={msNote} onChange={e => setMsNote(e.target.value)} placeholder="…"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={addMilestone} disabled={!msDate || msAdding}
                  style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, opacity: !msDate || msAdding ? 0.6 : 1 }}>
                  {msAdding ? t('memberProfile.savingMilestone' as any) : t('memberProfile.saveMilestone' as any)}
                </button>
                <button onClick={() => { setMsFormOpen(false); setMsDate(''); setMsNote('') }}
                  style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* Score History Chart */}
        {scoreHistory.length > 1 && (
          <Section title={t('memberProfile.sectScores' as any)} icon="📊">
            {(() => {
              const W = 480, H = 130, PAD = { top: 10, bottom: 28, left: 32, right: 12 }
              const chartW = W - PAD.left - PAD.right
              const chartH = H - PAD.top - PAD.bottom
              const maxVal = Math.max(...scoreHistory.map(p => p.total), 1)
              const xs = scoreHistory.map((_, i) => PAD.left + (i / (scoreHistory.length - 1)) * chartW)
              const ys = scoreHistory.map(p => PAD.top + chartH - (p.total / maxVal) * chartH)
              const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ')
              const area = [`${xs[0]},${PAD.top + chartH}`, ...xs.map((x, i) => `${x},${ys[i]}`), `${xs[xs.length - 1]},${PAD.top + chartH}`].join(' ')
              return (
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
                  <defs>
                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* horizontal grid */}
                  {[0, .5, 1].map(f => (
                    <line key={f} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + chartH * (1 - f)} y2={PAD.top + chartH * (1 - f)} stroke="#e5e7eb" strokeWidth="1" />
                  ))}
                  <polygon points={area} fill="url(#sg)" />
                  <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {xs.map((x, i) => (
                    <circle key={i} cx={x} cy={ys[i]} r="4" fill="#6366f1" stroke="#fff" strokeWidth="1.5">
                      <title>{scoreHistory[i].month}: {scoreHistory[i].total}</title>
                    </circle>
                  ))}
                  {/* x-axis labels — show first, last, and middle */}
                  {[0, Math.floor(scoreHistory.length / 2), scoreHistory.length - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => (
                    <text key={i} x={xs[i]} y={H - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">
                      {scoreHistory[i].month.substring(5)}/{scoreHistory[i].month.substring(2, 4)}
                    </text>
                  ))}
                  {/* y-axis max label */}
                  <text x={PAD.left - 4} y={PAD.top + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{maxVal}</text>
                </svg>
              )
            })()}
          </Section>
        )}

        {/* User Account — admin/priest/leader only */}
        {canManageUsers && (
          <Section title={t('memberProfile.sectAccount' as any)} icon="🔗">
            {servantInfo?.username ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', background: '#f0f9ff', padding: '4px 10px', borderRadius: 6, border: '1px solid #bae6fd' }}>
                  👤 {servantInfo.username}
                </span>
                <button onClick={unlinkUser} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                  {t('memberProfile.unlinkAccount' as any)}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder={t('memberProfile.linkUserPlaceholder' as any)}
                    value={linkUsername}
                    onChange={e => setLinkUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && linkUser()}
                    style={{ flex: 1, maxWidth: 240, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                  <button
                    onClick={linkUser}
                    disabled={linking || !linkUsername.trim()}
                    style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, opacity: linking || !linkUsername.trim() ? 0.6 : 1 }}
                  >
                    {linking ? '…' : t('memberProfile.linkButton' as any)}
                  </button>
                  {linkErr && <span style={{ color: '#dc2626', fontSize: '0.82rem' }}>{linkErr}</span>}
                </div>
                <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: '8px 0 0' }}>
                  {t('memberProfile.linkDescription' as any)}
                </p>
              </div>
            )}
          </Section>
        )}

      </div>

      {/* Edit modal (admin/servant) */}
      {editOpen && (
        <MemberFormModal
          familyId={member.familyId}
          member={member}
          onSaved={updated => {
            setMember(updated)
            setEditOpen(false)
          }}
          onCancel={() => setEditOpen(false)}
        />
      )}

      {/* Self-edit modal (member requesting update to own profile) */}
      {selfEditOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 6px' }}>{t('memberProfile.selfEditTitle' as any)}</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>{t('memberProfile.selfEditSubtitle' as any)}</p>

            {([
              ['mobile',           t('memberProfile.fieldMobile' as any),        'text'],
              ['church',           t('memberProfile.fieldChurch' as any),         'text'],
              ['meetingAttended',  t('memberProfile.fieldMeeting' as any),        'text'],
              ['confessionFather', t('memberProfile.fieldConfession' as any),     'text'],
              ['jobTitle',         t('memberProfile.fieldJobTitle' as any),       'text'],
              ['jobDetails',       t('memberProfile.fieldJobDetails' as any),     'text'],
              ['college',          t('memberProfile.fieldCollege' as any),        'text'],
              ['studyYear',        t('memberProfile.fieldStudyYear' as any),      'text'],
              ['qualification',    t('memberProfile.fieldQualification' as any),  'text'],
              ['notes',            t('memberProfile.fieldNotes' as any),          'textarea'],
            ] as [string, string, string][]).map(([key, label, type]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>{label}</label>
                {type === 'textarea'
                  ? <textarea value={(selfForm[key] as string) ?? ''} onChange={e => setSelfForm(f => ({ ...f, [key]: e.target.value }))}
                      rows={3} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none' }} />
                  : <input type="text" value={(selfForm[key] as string) ?? ''} onChange={e => setSelfForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                }
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={submitSelfEdit} disabled={selfSaving} className="btn btn-primary" style={{ flex: 1 }}>
                {selfSaving ? t('memberProfile.submitting' as any) : t('memberProfile.submitForReview' as any)}
              </button>
              <button onClick={() => setSelfEditOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
