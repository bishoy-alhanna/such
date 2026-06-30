import React, { useEffect, useState } from 'react'
import api from '../services/api'
import Header from '../components/Header'
import { useAuth } from '../auth'
import { useT } from '../i18n'

interface ClassMemberStatus {
  memberId: string
  memberName: string
  classId: string
  className: string
  isPresent: boolean
  attendanceId?: string
  notes?: string
}

interface AttendanceHistoryItem {
  id: string
  memberId: string
  memberName: string
  date: string
  attendanceType: string
  notes?: string
}

export default function AttendancePage() {
  const { user } = useAuth()
  const { t } = useT()
  const userRole = user?.role ?? ''
  const canAccessPage = ['SuperAdmin', 'Priest', 'SeniorPriest', 'ServiceLeader', 'DataEntry', 'Servant'].includes(userRole)
  const canManage = userRole !== 'Servant'

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [members, setMembers] = useState<ClassMemberStatus[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [history, setHistory] = useState<AttendanceHistoryItem[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)

  const fetchMembersStatus = async () => {
    setLoadingMembers(true)
    try {
      const res = await api.get<ClassMemberStatus[]>('/attendance/class-members-status', {
        params: { date: selectedDate, attendanceType: 'SundaySchool' }
      })
      setMembers(res.data || [])
      setMessage('')
    } catch {
      setMembers([])
    } finally {
      setLoadingMembers(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await api.get<any>('/attendance/my-classes', {
        params: { page: historyPage, pageSize: 20, attendanceType: 'SundaySchool' }
      })
      setHistory(res.data.items || [])
      setHistoryTotalPages(Math.ceil((res.data.totalCount || 0) / 20))
    } catch {
      setHistory([])
    }
  }

  const handleSave = async () => {
    const presentIds = members.filter(m => m.isPresent).map(m => m.memberId)
    if (presentIds.length === 0) { setMessage('اختر عضواً واحداً على الأقل.'); return }
    setSaving(true)
    setMessage('')
    try {
      await api.post('/attendance/bulk', { date: selectedDate, attendanceType: 'SundaySchool', memberIds: presentIds })
      setMessage(`✓ تم تسجيل حضور ${presentIds.length} عضو`)
      fetchHistory()
    } catch {
      setMessage('فشل في حفظ الحضور.')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا السجل؟')) return
    try {
      await api.delete(`/attendance/${id}`)
      fetchHistory()
      fetchMembersStatus()
    } catch {
      alert('فشل في الحذف.')
    }
  }

  useEffect(() => { fetchMembersStatus() }, [selectedDate])
  useEffect(() => { fetchHistory() }, [historyPage])

  if (!canAccessPage) return (
    <div><Header />
      <div className="container">
        <p style={{ textAlign: 'center', color: '#888', marginTop: '2rem' }}>ليس لديك صلاحية لعرض هذه الصفحة.</p>
      </div>
    </div>
  )

  const presentCount = members.filter(m => m.isPresent).length

  return (
    <div>
      <Header />
      <div className="container" style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#1f2937' }}>📚 {t('attendance.title')}</h2>
        </div>

        {/* Recording card */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.82rem', fontWeight: 600, color: '#6b7280' }}>{t('attendance.date')}</label>
              <input type="date" value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          {message && (
            <div style={{
              padding: '8px 14px', borderRadius: 6, marginBottom: 12,
              background: message.startsWith('✓') ? '#f0fdf4' : '#fef2f2',
              color: message.startsWith('✓') ? '#166534' : '#dc2626',
              border: `1px solid ${message.startsWith('✓') ? '#86efac' : '#fca5a5'}`,
              fontSize: '0.88rem'
            }}>{message}</div>
          )}

          {loadingMembers ? (
            <p style={{ textAlign: 'center', color: '#9ca3af' }}>{t('attendance.loading')}</p>
          ) : members.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9ca3af' }}>{t('attendance.noMembers')}</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t('attendance.present', { n: presentCount, total: members.length })}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setMembers(p => p.map(m => ({ ...m, isPresent: true })))}
                    style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', fontSize: '0.82rem', background: 'white' }}>
                    {t('attendance.selectAll')}
                  </button>
                  <button onClick={() => setMembers(p => p.map(m => ({ ...m, isPresent: false })))}
                    style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', fontSize: '0.82rem', background: 'white' }}>
                    {t('attendance.deselectAll')}
                  </button>
                </div>
              </div>

              <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                {members.map(m => (
                  <div key={m.memberId}
                    onClick={() => setMembers(p => p.map(x => x.memberId === m.memberId ? { ...x, isPresent: !x.isPresent } : x))}
                    style={{
                      padding: '10px 14px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: m.isPresent ? '#f0fdf4' : 'white',
                    }}
                  >
                    <input type="checkbox" checked={m.isPresent} onChange={() => {}} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.memberName}</div>
                      <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{m.className}</div>
                    </div>
                    {m.isPresent && <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleSave} disabled={saving || presentCount === 0} style={{
                  padding: '8px 24px', background: '#4f46e5', color: 'white',
                  border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                  opacity: saving || presentCount === 0 ? 0.6 : 1
                }}>
                  {saving ? '…' : `${t('attendance.save')} (${presentCount})`}
                </button>
              </div>
            </>
          )}
        </div>

        {/* History */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>{t('attendance.save')}</h3>

          {history.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '1rem 0' }}>{t('attendance.noRecords')}</p>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                      {[t('attendance.date'), t('attendance.memberName'), t('attendance.class'), t('attendance.notes')].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>{h}</th>
                      ))}
                      {canManage && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{new Date(r.date).toLocaleDateString('ar-EG')}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.memberName}</td>
                        <td style={{ padding: '8px 12px', color: '#6b7280' }}>📚 مدرسة الأحد</td>
                        <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.notes || '—'}</td>
                        {canManage && (
                          <td style={{ padding: '8px 12px' }}>
                            <button onClick={() => handleDelete(r.id)} style={{
                              padding: '3px 10px', background: 'transparent', color: '#ef4444',
                              border: '1px solid #fca5a5', borderRadius: 5, fontSize: '0.78rem', cursor: 'pointer'
                            }}>حذف</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {historyTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}
                    style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: 'white' }}>{t('attendance.prev')}</button>
                  <span style={{ alignSelf: 'center', fontSize: '0.88rem', color: '#6b7280' }}>{historyPage} / {historyTotalPages}</span>
                  <button onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} disabled={historyPage === historyTotalPages}
                    style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: 'white' }}>{t('attendance.next')}</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
