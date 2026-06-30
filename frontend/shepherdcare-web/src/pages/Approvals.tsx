import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import api from '../services/api'

interface PendingScore {
  id: string
  memberId: string
  memberName: string | null
  categoryId: string
  categoryName: string | null
  date: string
  note: string | null
  status: string
  submittedAt: string
  submittedByName: string | null
}

interface PendingUpdate {
  id: string
  memberId: string
  memberName: string | null
  changesJson: string
  status: string
  submittedAt: string
  submittedByName: string | null
}

interface PendingUser {
  id: string
  username: string
  displayName?: string
  createdAt: string
  roleName?: string
}

interface Role { id: string; name: string; description?: string }

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
}

function parseChanges(json: string): Record<string, string> {
  try { return JSON.parse(json) ?? {} } catch { return {} }
}

const FIELD_LABELS: Record<string, string> = {
  mobile: '📞 هاتف', gender: '👤 جنس', dateOfBirth: '🎂 تاريخ ميلاد',
  occupationStatus: '💼 حالة عمل', studyYear: '📚 سنة دراسة', college: '🎓 كلية',
  jobTitle: '💼 وظيفة', jobDetails: '🏢 تفاصيل عمل', qualification: '🏅 مؤهل',
  church: '⛪ كنيسة', meetingAttended: '📍 اجتماع', confessionFather: '✝ أب اعتراف',
  notes: '📝 ملاحظات',
}

const ROLE_AR: Record<string, string> = {
  SuperAdmin: 'مدير النظام', Priest: 'كاهن', SeniorPriest: 'الأب الكاهن',
  ServiceLeader: 'رئيس الخدمة', Servant: 'خادم', DataEntry: 'إدخال بيانات', Member: 'عضو',
}

export default function ApprovalsPage() {
  const [tab, setTab] = useState<'users' | 'scores' | 'profiles'>('users')

  // Pending user accounts
  const [pendingUsers, setPendingUsers]   = useState<PendingUser[]>([])
  const [roles, setRoles]                 = useState<Role[]>([])
  const [approveRoleId, setApproveRoleId] = useState<Record<string, string>>({})
  const [approvingUser, setApprovingUser] = useState<string | null>(null)

  // Pending scores
  const [pendingScores, setPendingScores] = useState<PendingScore[]>([])

  // Pending profile updates
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([])

  const [loading, setLoading]             = useState(false)
  const [reviewNote, setReviewNote]       = useState<Record<string, string>>({})
  const [processing, setProcessing]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [users, rolesRes, scores, updates] = await Promise.all([
        api.get<PendingUser[]>('/users/pending'),
        api.get<Role[]>('/roles'),
        api.get<PendingScore[]>('/scores/pending'),
        api.get<PendingUpdate[]>('/members/pending-updates'),
      ])
      setPendingUsers(users.data)
      setRoles(rolesRes.data)
      // Default each pending user to "Member" role
      const memberRole = rolesRes.data.find(r => r.name === 'Member')
      const defaults: Record<string, string> = {}
      users.data.forEach(u => { defaults[u.id] = memberRole?.id ?? rolesRes.data[0]?.id ?? '' })
      setApproveRoleId(defaults)
      setPendingScores(scores.data)
      setPendingUpdates(updates.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── User account actions ──────────────────────────────────────────────────
  const approveUser = async (id: string) => {
    const roleId = approveRoleId[id]
    if (!roleId) { alert('يرجى اختيار الدور'); return }
    setApprovingUser(id)
    try {
      await api.post(`/users/${id}/approve`, { roleId })
      setPendingUsers(prev => prev.filter(u => u.id !== id))
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'حدث خطأ')
    }
    setApprovingUser(null)
  }

  const rejectUser = async (id: string, username: string) => {
    if (!window.confirm(`رفض وحذف حساب "${username}"؟`)) return
    try {
      await api.delete(`/users/${id}/reject`)
      setPendingUsers(prev => prev.filter(u => u.id !== id))
    } catch { alert('حدث خطأ') }
  }

  // ── Score actions ─────────────────────────────────────────────────────────
  const approveScore = async (id: string) => {
    setProcessing(id)
    try {
      await api.post(`/scores/pending/${id}/approve`, { note: reviewNote[id] ?? null })
      setPendingScores(prev => prev.filter(s => s.id !== id))
    } catch { alert('حدث خطأ') }
    finally { setProcessing(null) }
  }

  const rejectScore = async (id: string) => {
    const note = reviewNote[id]?.trim()
    if (!note) { alert('يرجى كتابة سبب الرفض'); return }
    setProcessing(id)
    try {
      await api.post(`/scores/pending/${id}/reject`, { note })
      setPendingScores(prev => prev.filter(s => s.id !== id))
    } catch { alert('حدث خطأ') }
    finally { setProcessing(null) }
  }

  // ── Profile update actions ────────────────────────────────────────────────
  const approveUpdate = async (id: string) => {
    setProcessing(id)
    try {
      await api.post(`/members/pending-updates/${id}/approve`, { note: reviewNote[id] ?? null })
      setPendingUpdates(prev => prev.filter(u => u.id !== id))
    } catch { alert('حدث خطأ') }
    finally { setProcessing(null) }
  }

  const rejectUpdate = async (id: string) => {
    const note = reviewNote[id]?.trim()
    if (!note) { alert('يرجى كتابة سبب الرفض'); return }
    setProcessing(id)
    try {
      await api.post(`/members/pending-updates/${id}/reject`, { note })
      setPendingUpdates(prev => prev.filter(u => u.id !== id))
    } catch { alert('حدث خطأ') }
    finally { setProcessing(null) }
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
    padding: '18px 20px', marginBottom: 12,
  }

  const totalPending = pendingUsers.length + pendingScores.length + pendingUpdates.length

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <h2 style={{ margin: 0 }}>
            ✅ الموافقات المعلقة
            {totalPending > 0 && (
              <span style={{ marginRight: 10, fontSize: 14, background: '#6366f1', color: '#fff', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>
                {totalPending}
              </span>
            )}
          </h2>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {([
            ['users',    `👤 طلبات التسجيل${pendingUsers.length > 0 ? ` (${pendingUsers.length})` : ''}`],
            ['scores',   `📊 طلبات الدرجات${pendingScores.length > 0 ? ` (${pendingScores.length})` : ''}`],
            ['profiles', `✏️ طلبات تعديل البيانات${pendingUpdates.length > 0 ? ` (${pendingUpdates.length})` : ''}`],
          ] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 20px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              borderColor: tab === t ? '#6366f1' : '#e5e7eb',
              background: tab === t ? '#6366f1' : '#fff',
              color: tab === t ? '#fff' : '#6b7280',
            }}>{label}</button>
          ))}
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>جارٍ التحميل…</p>
        ) : tab === 'users' ? (
          /* ── Pending user accounts ─────────────────────────────────── */
          pendingUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', background: '#f9fafb', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <div>لا توجد طلبات تسجيل معلقة</div>
            </div>
          ) : (
            pendingUsers.map(u => (
              <div key={u.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>
                      {u.displayName ?? u.username}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                      اسم المستخدم: <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{u.username}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                      سُجِّل في: {fmt(u.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
                    <select
                      value={approveRoleId[u.id] ?? ''}
                      onChange={e => setApproveRoleId(prev => ({ ...prev, [u.id]: e.target.value }))}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                    >
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{ROLE_AR[r.name] ?? r.name}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => approveUser(u.id)}
                        disabled={approvingUser === u.id}
                        style={{ flex: 1, padding: '7px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                      >
                        {approvingUser === u.id ? '…' : '✓ قبول'}
                      </button>
                      <button
                        onClick={() => rejectUser(u.id, u.username)}
                        disabled={approvingUser === u.id}
                        style={{ flex: 1, padding: '7px 0', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                      >
                        ✕ رفض
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )
        ) : tab === 'scores' ? (
          /* ── Pending scores ────────────────────────────────────────── */
          pendingScores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', background: '#f9fafb', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <div>لا توجد طلبات درجات معلقة</div>
            </div>
          ) : (
            pendingScores.map(s => (
              <div key={s.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <Link to={`/members/${s.memberId}`} style={{ fontWeight: 700, fontSize: 15, color: '#1f2937', textDecoration: 'none' }}>
                      {s.memberName ?? 'عضو غير معروف'}
                    </Link>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                      <span style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: 6, padding: '2px 8px', fontWeight: 600, marginInlineEnd: 8 }}>{s.categoryName}</span>
                      {fmt(s.date)}
                    </div>
                    {s.note && <div style={{ fontSize: 13, color: '#374151', marginTop: 6, fontStyle: 'italic' }}>"{s.note}"</div>}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                      قُدِّم بواسطة: {s.submittedByName ?? '—'} — {new Date(s.submittedAt).toLocaleString('ar-EG')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
                    <input
                      placeholder="ملاحظة (مطلوبة للرفض)"
                      value={reviewNote[s.id] ?? ''}
                      onChange={e => setReviewNote(n => ({ ...n, [s.id]: e.target.value }))}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => approveScore(s.id)} disabled={processing === s.id}
                        style={{ flex: 1, padding: '6px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                        {processing === s.id ? '…' : '✓ قبول'}
                      </button>
                      <button onClick={() => rejectScore(s.id)} disabled={processing === s.id}
                        style={{ flex: 1, padding: '6px 0', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                        {processing === s.id ? '…' : '✕ رفض'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          /* ── Pending profile updates ───────────────────────────────── */
          pendingUpdates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', background: '#f9fafb', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <div>لا توجد طلبات تعديل معلقة</div>
            </div>
          ) : (
            pendingUpdates.map(u => {
              const changes = parseChanges(u.changesJson)
              const entries = Object.entries(changes).filter(([, v]) => v != null && v !== '')
              return (
                <div key={u.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <Link to={`/members/${u.memberId}`} style={{ fontWeight: 700, fontSize: 15, color: '#1f2937', textDecoration: 'none' }}>
                        {u.memberName ?? 'عضو غير معروف'}
                      </Link>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10, marginTop: 2 }}>
                        قُدِّم بواسطة: {u.submittedByName ?? '—'} — {new Date(u.submittedAt).toLocaleString('ar-EG')}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                        {entries.map(([key, val]) => (
                          <div key={key} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{FIELD_LABELS[key] ?? key}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
                      <input
                        placeholder="ملاحظة (مطلوبة للرفض)"
                        value={reviewNote[u.id] ?? ''}
                        onChange={e => setReviewNote(n => ({ ...n, [u.id]: e.target.value }))}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => approveUpdate(u.id)} disabled={processing === u.id}
                          style={{ flex: 1, padding: '6px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                          {processing === u.id ? '…' : '✓ قبول'}
                        </button>
                        <button onClick={() => rejectUpdate(u.id)} disabled={processing === u.id}
                          style={{ flex: 1, padding: '6px 0', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                          {processing === u.id ? '…' : '✕ رفض'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )
        )}
      </div>
    </div>
  )
}
