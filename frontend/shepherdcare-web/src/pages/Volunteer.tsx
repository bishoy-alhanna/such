import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth'
import Header from '../components/Header'
import api from '../services/api'

interface Member { id: string; fullName: string; familyName?: string }
interface Assignment {
  id: string; memberId: string; memberName: string; familyName: string
  role: string; assignedDate?: string; eventTitle?: string; eventId?: string
  notes?: string; isRecurring: boolean
}
interface HoursRecord {
  id: string; memberId: string; memberName: string; familyName: string
  date: string; hours: number; activity: string; notes?: string
}
interface LeaderEntry { memberId: string; memberName: string; totalHours: number; entryCount: number }

const ROLES = ['Deacon', 'Reader', 'Cantor', 'Setup', 'Childcare', 'Hospitality', 'Other']
const ROLE_AR: Record<string, string> = {
  Deacon: 'شماس', Reader: 'قارئ', Cantor: 'مرتل',
  Setup: 'إعداد وترتيب', Childcare: 'رعاية أطفال', Hospitality: 'ضيافة', Other: 'أخرى',
}
const ROLE_ICON: Record<string, string> = {
  Deacon: '⛪', Reader: '📖', Cantor: '🎵',
  Setup: '🔧', Childcare: '👶', Hospitality: '🍽', Other: '📋',
}
const ROLE_COLOR: Record<string, string> = {
  Deacon: '#6366f1', Reader: '#0ea5e9', Cantor: '#8b5cf6',
  Setup: '#f59e0b', Childcare: '#ec4899', Hospitality: '#10b981', Other: '#6b7280',
}

export default function VolunteerPage() {
  const { user } = useAuth()
  const year = new Date().getFullYear()

  const [tab, setTab] = useState<'roster' | 'hours' | 'leaderboard'>('roster')

  // Roster
  const [assignments, setAssignments]   = useState<Assignment[]>([])
  const [filterRole, setFilterRole]     = useState('')
  const [filterFrom, setFilterFrom]     = useState('')
  const [filterTo, setFilterTo]         = useState('')
  const [loading, setLoading]           = useState(false)

  // Hours
  const [hours, setHours]               = useState<HoursRecord[]>([])
  const [filterMember, setFilterMember] = useState('')
  const [hoursLoading, setHoursLoading] = useState(false)

  // Leaderboard
  const [leaderboard, setLeaderboard]   = useState<LeaderEntry[]>([])
  const [lbYear, setLbYear]             = useState(year)

  // Members search
  const [members, setMembers]           = useState<Member[]>([])

  // Modals
  const [showAssign, setShowAssign]     = useState(false)
  const [showHours, setShowHours]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const [editId, setEditId]             = useState<string | null>(null)

  // Assignment form
  const [aMemberId, setAMemberId]       = useState('')
  const [aRole, setARole]               = useState('Deacon')
  const [aDate, setADate]               = useState('')
  const [aNotes, setANotes]             = useState('')
  const [aRecurring, setARecurring]     = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState<Member[]>([])

  // Hours form
  const [hMemberId, setHMemberId]       = useState('')
  const [hDate, setHDate]               = useState(new Date().toISOString().slice(0, 10))
  const [hHours, setHHours]             = useState('')
  const [hActivity, setHActivity]       = useState('')
  const [hNotes, setHNotes]             = useState('')
  const [hMemberSearch, setHMemberSearch] = useState('')
  const [hMemberResults, setHMemberResults] = useState<Member[]>([])

  const loadAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filterRole) params.role = filterRole
      if (filterFrom) params.from = filterFrom
      if (filterTo)   params.to   = filterTo
      const r = await api.get<Assignment[]>('/volunteer', { params })
      setAssignments(r.data)
    } catch { setAssignments([]) }
    finally { setLoading(false) }
  }, [filterRole, filterFrom, filterTo])

  const loadHours = useCallback(async () => {
    setHoursLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filterMember) params.memberId = filterMember
      const r = await api.get<HoursRecord[]>('/volunteer/service-hours', { params })
      setHours(r.data)
    } catch { setHours([]) }
    finally { setHoursLoading(false) }
  }, [filterMember])

  const loadLeaderboard = useCallback(async () => {
    try {
      const r = await api.get<LeaderEntry[]>('/volunteer/leaderboard', { params: { year: lbYear } })
      setLeaderboard(r.data)
    } catch { setLeaderboard([]) }
  }, [lbYear])

  useEffect(() => { if (tab === 'roster') loadAssignments() }, [tab, loadAssignments])
  useEffect(() => { if (tab === 'hours') loadHours() }, [tab, loadHours])
  useEffect(() => { if (tab === 'leaderboard') loadLeaderboard() }, [tab, loadLeaderboard])

  // Member autocomplete for assignment form
  useEffect(() => {
    if (memberSearch.length < 2) { setMemberResults([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await api.get<{ items: Member[] }>(`/members/search?q=${encodeURIComponent(memberSearch)}&pageSize=10`)
        setMemberResults(r.data.items ?? [])
      } catch {
        // fallback to families endpoint
        setMemberResults([])
      }
    }, 300)
    return () => clearTimeout(t)
  }, [memberSearch])

  useEffect(() => {
    if (hMemberSearch.length < 2) { setHMemberResults([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await api.get<{ items: Member[] }>(`/members/search?q=${encodeURIComponent(hMemberSearch)}&pageSize=10`)
        setHMemberResults(r.data.items ?? [])
      } catch { setHMemberResults([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [hMemberSearch])

  const openAssign = (a?: Assignment) => {
    if (a) {
      setEditId(a.id); setAMemberId(a.memberId); setARole(a.role)
      setADate(a.assignedDate ?? ''); setANotes(a.notes ?? ''); setARecurring(a.isRecurring)
      setMemberSearch(a.memberName)
    } else {
      setEditId(null); setAMemberId(''); setARole('Deacon'); setADate(''); setANotes(''); setARecurring(false); setMemberSearch('')
    }
    setMemberResults([])
    setShowAssign(true)
  }

  const saveAssignment = async () => {
    if (!aMemberId) return
    setSaving(true)
    try {
      const body = { memberId: aMemberId, role: aRole, assignedDate: aDate || null, notes: aNotes, isRecurring: aRecurring }
      if (editId) await api.put(`/volunteer/${editId}`, body)
      else await api.post('/volunteer', body)
      setShowAssign(false); loadAssignments()
    } catch {} finally { setSaving(false) }
  }

  const deleteAssignment = async (id: string) => {
    if (!confirm('حذف هذه المهمة؟')) return
    await api.delete(`/volunteer/${id}`); loadAssignments()
  }

  const saveHours = async () => {
    if (!hMemberId || !hHours) return
    setSaving(true)
    try {
      await api.post('/volunteer/service-hours', { memberId: hMemberId, date: hDate, hours: parseFloat(hHours), activity: hActivity, notes: hNotes })
      setShowHours(false); loadHours()
    } catch {} finally { setSaving(false) }
  }

  const deleteHours = async (id: string) => {
    if (!confirm('حذف هذا السجل؟')) return
    await api.delete(`/volunteer/service-hours/${id}`); loadHours()
  }

  const maxHours = Math.max(...leaderboard.map(e => e.totalHours), 1)

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <h2 style={{ margin: 0 }}>🙋 الخدمة والمتطوعون</h2>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #f3f4f6', flexWrap: 'wrap' }}>
          {([['roster','جدول الخدمة'],['hours','ساعات الخدمة'],['leaderboard','لوحة الشرف']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 18px', fontSize: 14, fontWeight: 600,
              color: tab === k ? '#6366f1' : '#6b7280',
              borderBottom: tab === k ? '2px solid #6366f1' : '2px solid transparent', marginBottom: -2,
            }}>{l}</button>
          ))}
        </div>

        {/* ── Roster ── */}
        {tab === 'roster' && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none' }}>
                <option value="">كل الأدوار</option>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_ICON[r]} {ROLE_AR[r]}</option>)}
              </select>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
              <span style={{ color: '#9ca3af' }}>—</span>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
              <button onClick={loadAssignments} className="btn btn-secondary">بحث</button>
              <button onClick={() => openAssign()} className="btn btn-primary">+ إضافة</button>
            </div>

            {/* Role summary chips */}
            {!filterRole && assignments.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {ROLES.filter(r => assignments.some(a => a.role === r)).map(r => {
                  const cnt = assignments.filter(a => a.role === r).length
                  return (
                    <span key={r} onClick={() => setFilterRole(r)} style={{
                      background: ROLE_COLOR[r] + '18', color: ROLE_COLOR[r], border: `1px solid ${ROLE_COLOR[r]}44`,
                      padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {ROLE_ICON[r]} {ROLE_AR[r]} ({cnt})
                    </span>
                  )
                })}
              </div>
            )}

            {loading ? <p style={{ textAlign: 'center', color: '#9ca3af' }}>جارٍ التحميل…</p>
              : assignments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
                  <div>لا توجد مهام مسجلة</div>
                </div>
              ) : (
                <div className="card">
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ minWidth: 560 }}>
                      <thead><tr><th>العضو</th><th>الدور</th><th>التاريخ</th><th>ملاحظات</th><th>متكرر</th><th></th></tr></thead>
                      <tbody>
                        {assignments.map(a => (
                          <tr key={a.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{a.memberName}</div>
                              <div style={{ fontSize: 11, color: '#9ca3af' }}>{a.familyName}</div>
                            </td>
                            <td>
                              <span style={{ background: ROLE_COLOR[a.role] + '18', color: ROLE_COLOR[a.role], padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                                {ROLE_ICON[a.role]} {ROLE_AR[a.role]}
                              </span>
                            </td>
                            <td style={{ color: '#6b7280', fontSize: 13 }}>{a.assignedDate ? new Date(a.assignedDate).toLocaleDateString('ar-EG') : '—'}</td>
                            <td style={{ color: '#6b7280', fontSize: 13 }}>{a.notes ?? '—'}</td>
                            <td>{a.isRecurring ? '↻' : '—'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => openAssign(a)} className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }}>تعديل</button>
                                <button onClick={() => deleteAssignment(a.id)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>حذف</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            }
          </>
        )}

        {/* ── Service hours ── */}
        {tab === 'hours' && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>
                الإجمالي: <strong style={{ color: '#1f2937' }}>{hours.reduce((s, h) => s + h.hours, 0).toFixed(1)} ساعة</strong>
              </div>
              <button onClick={() => { setHMemberId(''); setHDate(new Date().toISOString().slice(0,10)); setHHours(''); setHActivity(''); setHNotes(''); setHMemberSearch(''); setHMemberResults([]); setShowHours(true) }}
                className="btn btn-primary">+ إضافة ساعات</button>
            </div>

            {hoursLoading ? <p style={{ textAlign: 'center', color: '#9ca3af' }}>جارٍ التحميل…</p>
              : hours.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>⏱</div>
                  <div>لا توجد ساعات مسجلة</div>
                </div>
              ) : (
                <div className="card">
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ minWidth: 500 }}>
                      <thead><tr><th>العضو</th><th>التاريخ</th><th>الساعات</th><th>النشاط</th><th></th></tr></thead>
                      <tbody>
                        {hours.map(h => (
                          <tr key={h.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{h.memberName}</div>
                              <div style={{ fontSize: 11, color: '#9ca3af' }}>{h.familyName}</div>
                            </td>
                            <td style={{ color: '#6b7280', fontSize: 13 }}>{new Date(h.date).toLocaleDateString('ar-EG')}</td>
                            <td style={{ fontWeight: 700, color: '#6366f1' }}>{h.hours}h</td>
                            <td style={{ color: '#374151', fontSize: 13 }}>{h.activity}</td>
                            <td>
                              <button onClick={() => deleteHours(h.id)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>حذف</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            }
          </>
        )}

        {/* ── Leaderboard ── */}
        {tab === 'leaderboard' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>السنة:</span>
              <select value={lbYear} onChange={e => setLbYear(Number(e.target.value))}
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 13, outline: 'none' }}>
                {Array.from({ length: 5 }, (_, i) => year - i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
                <div>لا توجد بيانات بعد</div>
              </div>
            ) : (
              <div className="card">
                {leaderboard.map((e, i) => (
                  <div key={e.memberId} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < leaderboard.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#d97706' : '#e5e7eb', width: 28, textAlign: 'center' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{e.memberName}</div>
                      <div style={{ marginTop: 4, background: '#f3f4f6', borderRadius: 9999, height: 6, overflow: 'hidden' }}>
                        <div style={{ background: i < 3 ? '#6366f1' : '#a5b4fc', height: '100%', width: `${(e.totalHours / maxHours) * 100}%`, borderRadius: 9999 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#1f2937', fontSize: 16 }}>{e.totalHours.toFixed(1)}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>ساعة ({e.entryCount})</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Assignment modal */}
        {showAssign && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
              <h3 style={{ margin: '0 0 20px' }}>{editId ? 'تعديل مهمة' : 'إضافة مهمة خدمة'}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>العضو</label>
                  <input value={memberSearch} onChange={e => { setMemberSearch(e.target.value); if (!e.target.value) setAMemberId('') }}
                    placeholder="ابحث بالاسم…"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                  {memberResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.1)', overflow: 'hidden' }}>
                      {memberResults.map(m => (
                        <div key={m.id} onClick={() => { setAMemberId(m.id); setMemberSearch(m.fullName); setMemberResults([]) }}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f5f3ff'}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = '#fff'}>
                          {m.fullName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>الدور</label>
                  <select value={aRole} onChange={e => setARole(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }}>
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_ICON[r]} {ROLE_AR[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>التاريخ (اختياري)</label>
                  <input type="date" value={aDate} onChange={e => setADate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>ملاحظات</label>
                  <input value={aNotes} onChange={e => setANotes(e.target.value)} placeholder="اختياري"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={aRecurring} onChange={e => setARecurring(e.target.checked)} />
                  ↻ متكرر (أسبوعياً)
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={saveAssignment} disabled={saving || !aMemberId} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'جارٍ الحفظ…' : 'حفظ'}</button>
                <button onClick={() => setShowAssign(false)} className="btn btn-secondary" style={{ flex: 1 }}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {/* Service hours modal */}
        {showHours && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
              <h3 style={{ margin: '0 0 20px' }}>⏱ تسجيل ساعات خدمة</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>العضو</label>
                  <input value={hMemberSearch} onChange={e => { setHMemberSearch(e.target.value); if (!e.target.value) setHMemberId('') }}
                    placeholder="ابحث بالاسم…"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                  {hMemberResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.1)', overflow: 'hidden' }}>
                      {hMemberResults.map(m => (
                        <div key={m.id} onClick={() => { setHMemberId(m.id); setHMemberSearch(m.fullName); setHMemberResults([]) }}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f5f3ff'}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = '#fff'}>
                          {m.fullName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>التاريخ</label>
                  <input type="date" value={hDate} onChange={e => setHDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>عدد الساعات</label>
                  <input type="number" step="0.5" value={hHours} onChange={e => setHHours(e.target.value)} placeholder="0.0"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 15, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>النشاط</label>
                  <input value={hActivity} onChange={e => setHActivity(e.target.value)} placeholder="مثال: تجهيز القداس، رعاية أطفال…"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>ملاحظات</label>
                  <input value={hNotes} onChange={e => setHNotes(e.target.value)} placeholder="اختياري"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={saveHours} disabled={saving || !hMemberId || !hHours} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'جارٍ الحفظ…' : 'حفظ'}</button>
                <button onClick={() => setShowHours(false)} className="btn btn-secondary" style={{ flex: 1 }}>إلغاء</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
