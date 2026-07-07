import React, { useState, useRef } from 'react'
import api from '../services/api'
import { mapValidationErrors } from '../utils/validation'
import type { Member } from '../types'
import { useT } from '../i18n'

interface Props {
  /** Omit to create/edit a standalone member with no family yet. */
  familyId?: string
  member?: Member | null
  onSaved: (m: Member) => void
  onCancel: () => void
}

type Tab = 'basic' | 'work' | 'church' | 'service'

const RELATION_OPTIONS = [
  { value: 'Head',       label: 'رب الأسرة' },
  { value: 'Spouse',     label: 'زوجة / زوج' },
  { value: 'Son',        label: 'ابن' },
  { value: 'Daughter',   label: 'ابنة' },
  { value: 'Father',     label: 'أب' },
  { value: 'Mother',     label: 'أم' },
  { value: 'Brother',    label: 'أخ' },
  { value: 'Sister',     label: 'أخت' },
  { value: 'Grandfather',label: 'جد' },
  { value: 'Grandmother',label: 'جدة' },
  { value: 'Other',      label: 'أخرى' },
]

const STATUS_OPTIONS = ['نشط', 'غير نشط', 'متزوج', 'مغترب', 'متوفى']

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
)

const Field = ({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) => (
  <div style={full ? { gridColumn: '1 / -1' } : {}}>
    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>{label}</label>
    {children}
  </div>
)

export default function MemberFormModal({ familyId, member, onSaved, onCancel }: Props) {
  const { t } = useT()
  const isEdit = !!member
  const [tab, setTab] = useState<Tab>('basic')
  // No family yet (new standalone member, or editing one that hasn't been placed in a family):
  // let the admin optionally supply the father's National ID to find/create the family.
  const showFatherField = !familyId
  const [fatherNationalId, setFatherNationalId] = useState('')

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'basic',   label: t('members.basicInfo'),  icon: '👤' },
    { key: 'work',    label: t('members.education'),  icon: '🎓' },
    { key: 'church',  label: t('members.church'),     icon: '⛪' },
    { key: 'service', label: t('members.service'),    icon: '✝️' },
  ]
  const [newCredentials, setNewCredentials] = useState<{ username: string; defaultPassword: string } | null>(null)

  // Basic
  const [fullName, setFullName]       = useState(member?.fullName ?? '')
  const [gender, setGender]           = useState(member?.gender ?? '')
  const [dob, setDob]                 = useState(member?.dateOfBirth?.substring(0,10) ?? '')
  const [relation, setRelation]       = useState(member?.relation ?? '')
  const [mobile, setMobile]           = useState(member?.mobile ?? '')
  const [isChild, setIsChild]         = useState(member?.isChild ?? false)
  const [nationalId, setNationalId]   = useState(member?.nationalId ?? '')
  const [status, setStatus]           = useState(member?.status ?? '')
  const [notes, setNotes]             = useState(member?.notes ?? '')
  const [photoUrl, setPhotoUrl]       = useState(member?.photoUrl ?? '')
  const [photoPreview, setPhotoPreview] = useState<string | null>(member?.photoUrl
    ? (member.photoUrl.startsWith('/uploads/') ? member.photoUrl : member.photoUrl)
    : null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Show local preview immediately
    const localUrl = URL.createObjectURL(file)
    setPhotoPreview(localUrl)

    // If editing an existing member, upload now
    if (isEdit && member?.id) {
      setPhotoUploading(true)
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await api.post(`/members/${member.id}/photo`, form)
        setPhotoUrl(res.data.photoUrl)
        setPhotoPreview(res.data.photoUrl)
      } catch {
        // keep local preview, will be saved with member update
      } finally {
        setPhotoUploading(false)
      }
    } else {
      // Store file to upload after member is created
      setPendingPhotoFile(file)
    }
  }
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null)

  // Work / Education
  const [occupationStatus, setOccupationStatus] = useState(member?.occupationStatus ?? '')
  const [studyYear, setStudyYear]               = useState(member?.studyYear ?? '')
  const [college, setCollege]                   = useState(member?.college ?? '')
  const [jobTitle, setJobTitle]                 = useState(member?.jobTitle ?? '')
  const [jobDetails, setJobDetails]             = useState(member?.jobDetails ?? '')
  const [qualification, setQualification]       = useState(member?.qualification ?? '')

  // Church
  const [church, setChurch]                         = useState(member?.church ?? '')
  const [meetingAttended, setMeetingAttended]       = useState(member?.meetingAttended ?? '')
  const [confessionFather, setConfessionFather]     = useState(member?.confessionFather ?? '')
  const [lastConfessionDate, setLastConfessionDate] = useState(member?.lastConfessionDate?.substring(0,10) ?? '')
  const [lastCommunionDate, setLastCommunionDate]   = useState(member?.lastCommunionDate?.substring(0,10) ?? '')
  const [lastCallDate, setLastCallDate]             = useState(member?.lastCallDate?.substring(0,10) ?? '')

  // Coptic identity
  const [baptismName, setBaptismName]   = useState(member?.baptismName ?? '')
  const [nameDayMonth, setNameDayMonth] = useState(member?.nameDayMonth ? String(member.nameDayMonth) : '')
  const [nameDayDay, setNameDayDay]     = useState(member?.nameDayDay ? String(member.nameDayDay) : '')

  // Service
  const [isServant, setIsServant]   = useState(member?.isServant ?? false)
  const [serviceType, setServiceType] = useState(member?.serviceType ?? '')

  const [errors, setErrors]   = useState<Record<string, string[]>>({})
  const [saving, setSaving]   = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nationalId.trim() && !/^\d{14}$/.test(nationalId.trim())) {
      setErrors({ NationalId: ['الرقم القومي يجب أن يكون 14 رقماً بالضبط.'] })
      setTab('basic')
      setSaving(false)
      return
    }
    if (fatherNationalId.trim() && !/^\d{14}$/.test(fatherNationalId.trim())) {
      setErrors({ FatherNationalId: ['الرقم القومي للأب يجب أن يكون 14 رقماً بالضبط.'] })
      setTab('basic')
      setSaving(false)
      return
    }
    setSaving(true)
    setErrors({})
    const payload = {
      familyId,
      fatherNationalId: showFatherField ? (fatherNationalId.trim() || undefined) : undefined,
      fullName, gender: gender || undefined, dateOfBirth: dob || undefined,
      relation: relation || undefined, mobile: mobile || undefined,
      isChild, notes: notes || undefined,
      nationalId: nationalId.trim() || undefined,
      status: status || undefined, photoUrl: photoUrl || undefined,
      occupationStatus: occupationStatus || undefined,
      studyYear: studyYear || undefined, college: college || undefined,
      jobTitle: jobTitle || undefined, jobDetails: jobDetails || undefined,
      qualification: qualification || undefined,
      church: church || undefined, meetingAttended: meetingAttended || undefined,
      confessionFather: confessionFather || undefined,
      lastConfessionDate: lastConfessionDate || undefined,
      lastCommunionDate: lastCommunionDate || undefined,
      lastCallDate: lastCallDate || undefined,
      isServant, serviceType: serviceType || undefined,
      baptismName: baptismName || undefined,
      nameDayMonth: nameDayMonth ? parseInt(nameDayMonth) : undefined,
      nameDayDay: nameDayDay ? parseInt(nameDayDay) : undefined,
    }
    try {
      if (isEdit) {
        const putRes = await api.put<{ servantUser?: { username: string; defaultPassword: string } }>(`/members/${member!.id}`, payload)
        if (putRes.data?.servantUser) {
          setNewCredentials(putRes.data.servantUser)
        }
        // Refetch rather than optimistically merge `payload`: when a father's National ID was
        // supplied, the server may resolve/create a FamilyId that isn't reflected locally.
        const fresh = await api.get<Member>(`/members/${member!.id}`)
        onSaved(fresh.data)
      } else {
        const res = await api.post<Member & { servantUser?: { username: string; defaultPassword: string } }>('/members', payload)
        let saved = res.data
        if (res.data.servantUser) setNewCredentials(res.data.servantUser)
        if (pendingPhotoFile) {
          try {
            const form = new FormData()
            form.append('file', pendingPhotoFile)
            const photoRes = await api.post(`/members/${saved.id}/photo`, form)
            saved = { ...saved, photoUrl: photoRes.data.photoUrl }
          } catch { /* photo upload failed, continue anyway */ }
        }
        onSaved(saved)
      }
    } catch (err: unknown) {
      setErrors(mapValidationErrors(err))
    } finally {
      setSaving(false)
    }
  }

  const inp = { style: { display: 'block', width: '100%', boxSizing: 'border-box' as const, margin: '0', padding: '7px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' } }

  if (newCredentials) {
    return (
      <div className="modal-backdrop">
        <div className="modal" style={{ maxWidth: 480, width: '100%', padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#166534' }}>{t('members.servantCreated')}</h3>
          <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: '0.9rem' }}>
            {t('members.servantKeep')}
          </p>
          <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginBottom: 20, textAlign: 'right', direction: 'ltr' }}>
            <div style={{ marginBottom: 8, fontSize: '0.88rem' }}>
              <span style={{ color: '#6b7280' }}>Username: </span>
              <strong style={{ fontFamily: 'monospace', fontSize: '1rem' }}>{newCredentials.username}</strong>
            </div>
            <div style={{ fontSize: '0.88rem' }}>
              <span style={{ color: '#6b7280' }}>Password: </span>
              <strong style={{ fontFamily: 'monospace', fontSize: '1rem' }}>{newCredentials.defaultPassword}</strong>
            </div>
          </div>
          <p style={{ color: '#f59e0b', fontSize: '0.82rem', marginBottom: 20 }}>
            {t('members.servantWarn')}
          </p>
          <button
            onClick={() => { setNewCredentials(null); onCancel() }}
            style={{ padding: '9px 28px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
          >
            {t('members.servantOk')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 640, width: '100%', padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>
            {isEdit ? t('members.editMember', { name: member!.fullName }) : t('members.newMember')}
          </h3>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
          {TABS.map(t => (
            <button key={t.key} type="button"
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: tab === t.key ? 700 : 400,
                color: tab === t.key ? '#4f46e5' : '#6b7280',
                background: 'transparent',
                borderBottom: tab === t.key ? '2px solid #4f46e5' : '2px solid transparent',
                transition: 'all 0.15s'
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Form body */}
        <form onSubmit={submit}>
          <div style={{ padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto' }}>

            {/* ── Tab: Basic ── */}
            {tab === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="الاسم الكامل *">
                  <input value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="الاسم" {...inp} />
                  {errors.FullName && <div className="error">{errors.FullName.join(', ')}</div>}
                </Field>

                <Row>
                  <Field label="نوع الفرد *">
                    <select value={relation} onChange={e => setRelation(e.target.value)} required {...inp}>
                      <option value="">— اختر —</option>
                      {RELATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="النوع">
                    <select value={gender} onChange={e => setGender(e.target.value)} {...inp}>
                      <option value="">— اختر —</option>
                      <option value="Male">ذكر</option>
                      <option value="Female">أنثى</option>
                    </select>
                  </Field>
                </Row>

                <Row>
                  <Field label="رقم الهاتف">
                    <input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+20 1xx xxx xxxx" {...inp} />
                  </Field>
                  <Field label="تاريخ الميلاد">
                    <input type="date" value={dob} onChange={e => setDob(e.target.value)} {...inp} />
                  </Field>
                </Row>

                <Row>
                  <Field label="الحالة">
                    <select value={status} onChange={e => setStatus(e.target.value)} {...inp}>
                      <option value="">— اختر —</option>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="الرقم القومي">
                    <input value={nationalId}
                      onChange={e => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 14))}
                      placeholder="14 رقم" maxLength={14} inputMode="numeric"
                      style={{ ...inp.style, fontFamily: 'monospace', letterSpacing: '0.1em' }} />
                    {errors.NationalId && <div className="error">{errors.NationalId.join(', ')}</div>}
                  </Field>
                </Row>

                {showFatherField && (
                  <Field label="الرقم القومي للأب (اختياري)">
                    <input value={fatherNationalId}
                      onChange={e => setFatherNationalId(e.target.value.replace(/\D/g, '').slice(0, 14))}
                      placeholder="14 رقم — اتركه فارغاً إذا لم تتوفر أسرة بعد" maxLength={14} inputMode="numeric"
                      style={{ ...inp.style, fontFamily: 'monospace', letterSpacing: '0.1em' }} />
                    {errors.FatherNationalId && <div className="error">{errors.FatherNationalId.join(', ')}</div>}
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: 4 }}>
                      إذا كان الأب مسجلاً بالفعل سيتم إضافة الفرد إلى أسرته، وإلا سيتم إنشاء أسرة جديدة.
                      يمكن ترك الحقل فارغاً وإضافة الفرد لاحقاً إلى أسرة عند التعديل.
                    </div>
                  </Field>
                )}

                {/* Photo upload */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    style={{
                      width: 90, height: 90, borderRadius: 12, flexShrink: 0,
                      border: '2px dashed #d1d5db', cursor: 'pointer', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: '#f9fafb', position: 'relative'
                    }}
                  >
                    {photoUploading && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⏳</div>
                    )}
                    {photoPreview
                      ? <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 32, color: '#9ca3af' }}>📷</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>الصورة الشخصية</label>
                    <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoChange} style={{ display: 'none' }} />
                    <button type="button" onClick={() => photoInputRef.current?.click()}
                      style={{ ...inp.style, cursor: 'pointer', textAlign: 'center' as const, background: '#f1f5f9', border: '1px solid #d1d5db', color: '#374151' }}>
                      {photoPreview ? '🔄 تغيير الصورة' : '📤 رفع صورة'}
                    </button>
                    {photoPreview && (
                      <button type="button"
                        onClick={() => { setPhotoPreview(null); setPhotoUrl(''); setPendingPhotoFile(null) }}
                        style={{ marginTop: 6, fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block' }}>
                        ✕ حذف الصورة
                      </button>
                    )}
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: 4 }}>JPEG, PNG, WebP — بحد أقصى 5 MB</div>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isChild} onChange={e => setIsChild(e.target.checked)}
                    style={{ width: 'auto', margin: 0 }} />
                  طفل (أقل من 18 سنة)
                </label>

                <Field label="ملاحظات" full>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    rows={3} placeholder="ملاحظات اختيارية"
                    style={{ ...inp.style, resize: 'vertical', fontFamily: 'inherit' }} />
                </Field>
              </div>
            )}

            {/* ── Tab: Work / Education ── */}
            {tab === 'work' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="طالب / يعمل">
                  <select value={occupationStatus} onChange={e => setOccupationStatus(e.target.value)} {...inp}>
                    <option value="">— اختر —</option>
                    <option value="Student">طالب</option>
                    <option value="Working">يعمل</option>
                    <option value="Both">طالب ويعمل</option>
                    <option value="Neither">لا يعمل ولا يدرس</option>
                  </select>
                </Field>

                {(occupationStatus === 'Student' || occupationStatus === 'Both') && (
                  <Row>
                    <Field label="سنة الدراسة">
                      <input value={studyYear} onChange={e => setStudyYear(e.target.value)} placeholder="مثال: الثالثة" {...inp} />
                    </Field>
                    <Field label="الكلية">
                      <input value={college} onChange={e => setCollege(e.target.value)} placeholder="اسم الكلية" {...inp} />
                    </Field>
                  </Row>
                )}

                <Field label="المؤهل الدراسي">
                  <select value={qualification} onChange={e => setQualification(e.target.value)} {...inp}>
                    <option value="">— اختر —</option>
                    <option value="Primary">ابتدائي</option>
                    <option value="Preparatory">إعدادي</option>
                    <option value="Secondary">ثانوي</option>
                    <option value="Diploma">دبلوم</option>
                    <option value="Bachelor">بكالوريوس</option>
                    <option value="Masters">ماجستير</option>
                    <option value="PhD">دكتوراه</option>
                  </select>
                </Field>

                {(occupationStatus === 'Working' || occupationStatus === 'Both') && (
                  <>
                    <Row>
                      <Field label="الوظيفة">
                        <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="المسمى الوظيفي" {...inp} />
                      </Field>
                      <Field label="تفاصيل الوظيفة">
                        <input value={jobDetails} onChange={e => setJobDetails(e.target.value)} placeholder="مكان العمل / الجهة" {...inp} />
                      </Field>
                    </Row>
                  </>
                )}
              </div>
            )}

            {/* ── Tab: Church ── */}
            {tab === 'church' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Row>
                  <Field label="الاسم القبطي (اسم التعميد)">
                    <input value={baptismName} onChange={e => setBaptismName(e.target.value)} placeholder="مثال: أبيفانيوس" {...inp} />
                  </Field>
                  <Field label="عيد الاسم (يوم / شهر)">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" min={1} max={31} placeholder="يوم" value={nameDayDay}
                        onChange={e => setNameDayDay(e.target.value)} {...inp} style={{ width: 70, ...(inp as any).style }} />
                      <input type="number" min={1} max={12} placeholder="شهر" value={nameDayMonth}
                        onChange={e => setNameDayMonth(e.target.value)} {...inp} style={{ width: 70, ...(inp as any).style }} />
                    </div>
                  </Field>
                </Row>

                <Row>
                  <Field label="الكنيسة">
                    <input value={church} onChange={e => setChurch(e.target.value)} placeholder="اسم الكنيسة" {...inp} />
                  </Field>
                  <Field label="الاجتماع المشارك به">
                    <input value={meetingAttended} onChange={e => setMeetingAttended(e.target.value)} placeholder="مثال: شباب، خدمة..." {...inp} />
                  </Field>
                </Row>

                <Field label="اب الاعتراف">
                  <input value={confessionFather} onChange={e => setConfessionFather(e.target.value)} placeholder="اسم الأب" {...inp} />
                </Field>

                <Row>
                  <Field label="تاريخ آخر اعتراف">
                    <input type="date" value={lastConfessionDate} onChange={e => setLastConfessionDate(e.target.value)} {...inp} />
                  </Field>
                  <Field label="تاريخ آخر تناول">
                    <input type="date" value={lastCommunionDate} onChange={e => setLastCommunionDate(e.target.value)} {...inp} />
                  </Field>
                </Row>

                <Field label="تاريخ آخر مكالمة">
                  <input type="date" value={lastCallDate} onChange={e => setLastCallDate(e.target.value)} {...inp} />
                </Field>
              </div>
            )}

            {/* ── Tab: Service ── */}
            {tab === 'service' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.95rem', cursor: 'pointer',
                  padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 8,
                  background: isServant ? '#ede9fe' : '#f9fafb' }}>
                  <input type="checkbox" checked={isServant} onChange={e => setIsServant(e.target.checked)}
                    style={{ width: 'auto', margin: 0, transform: 'scale(1.3)' }} />
                  <span style={{ fontWeight: isServant ? 700 : 400 }}>✝️ هذا الفرد خادم</span>
                </label>

                {isServant && (
                  <Field label="نوع الخدمة">
                    <input value={serviceType} onChange={e => setServiceType(e.target.value)}
                      placeholder="مثال: تربية، كرازة، موسيقى..." {...inp} />
                  </Field>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {TABS.map((t, i) => (
                <div key={t.key} onClick={() => setTab(t.key)} style={{
                  width: 8, height: 8, borderRadius: '50%', cursor: 'pointer',
                  background: tab === t.key ? '#4f46e5' : '#d1d5db'
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onCancel} disabled={saving}
                style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('common.saving') : isEdit ? t('common.save') : t('family.addMember').replace('+ ', '')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
