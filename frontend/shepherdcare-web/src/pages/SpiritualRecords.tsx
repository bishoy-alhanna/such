import React, { useEffect, useState } from 'react'
import api from '../services/api'
import Header from '../components/Header'
import { useAuth } from '../auth'
import { useT } from '../i18n'

interface SpiritualHistoryItem {
  id: string
  memberId: string
  memberName: string
  type: string
  date: string
  notes?: string
  recordedByName?: string
}

interface MemberSuggestion {
  id: string
  fullName: string
  familyId: string
}

const TYPE_META: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  Confession: { label: 'اعتراف', icon: '🙏', color: '#6d28d9', bg: '#f5f3ff', border: '#c4b5fd' },
  Communion:  { label: 'تناول',  icon: '✝️', color: '#92400e', bg: '#fefce8', border: '#fcd34d' },
  Mass:       { label: 'قداس',   icon: '⛪', color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc' },
  Call:       { label: 'مكالمة', icon: '📞', color: '#1e40af', bg: '#eff6ff', border: '#93c5fd' },
}

export default function SpiritualRecordsPage() {
  const { user } = useAuth()
  const { t } = useT()
  const canAdd    = !!user?.role
  const canDelete = ['SuperAdmin', 'Priest', 'SeniorPriest'].includes(user?.role ?? '')

  const [memberQuery, setMemberQuery] = useState('')
  const [suggestions, setSuggestions] = useState<MemberSuggestion[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberSuggestion | null>(null)
  const [srType, setSrType] = useState<'Confession' | 'Communion' | 'Mass' | 'Call'>('Confession')
  const [srDate, setSrDate] = useState(new Date().toISOString().slice(0, 10))
  const [srNotes, setSrNotes] = useState('')
  const [srSaving, setSrSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [history, setHistory] = useState<SpiritualHistoryItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [typeFilter, setTypeFilter] = useState<'all' | 'Confession' | 'Communion' | 'Mass' | 'Call'>('all')

  const fetchHistory = async () => {
    try {
      const res = await api.get<any>('/spiritual-records', { params: { page, pageSize: 25 } })
      let items: SpiritualHistoryItem[] = res.data.items || []
      if (typeFilter !== 'all') items = items.filter(r => r.type === typeFilter)
      setHistory(items)
      setTotalPages(Math.ceil((res.data.totalCount || 0) / 25))
    } catch {
      setHistory([])
    }
  }

  useEffect(() => { fetchHistory() }, [page, typeFilter])

  useEffect(() => {
    if (memberQuery.length < 2) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await api.get<{ items: MemberSuggestion[] }>('/members/search', { params: { q: memberQuery, pageSize: 8 } })
        setSuggestions(res.data.items || [])
      } catch { setSuggestions([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [memberQuery])

  const saveRecord = async () => {
    if (!selectedMember) { setMessage('اختر عضواً أولاً.'); return }
    setSrSaving(true)
    setMessage('')
    try {
      await api.post('/spiritual-records', {
        memberId: selectedMember.id,
        type: srType,
        date: srDate,
        notes: srNotes || undefined,
      })
      setMessage(`✓ تم تسجيل ${TYPE_META[srType].label} لـ ${selectedMember.fullName}`)
      setSrNotes('')
      setPage(1)
      fetchHistory()
    } catch {
      setMessage('فشل في حفظ السجل.')
    }
    setSrSaving(false)
  }

  const deleteRecord = async (id: string) => {
    if (!confirm('حذف هذا السجل؟')) return
    try {
      await api.delete(`/spiritual-records/${id}`)
      fetchHistory()
    } catch {
      alert('فشل في الحذف.')
    }
  }

  return (
    <div>
      <Header />
      <div className="container" style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#1f2937' }}>{t('spiritual.title')}</h2>
        </div>

        {/* Add form */}
        {canAdd && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>{t('spiritual.addRecord')}</h3>

            {/* Member search */}
            <div style={{ marginBottom: 14, position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.82rem', fontWeight: 600, color: '#6b7280' }}>{t('spiritual.memberName')}</label>
              {selectedMember ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8 }}>
                  <span style={{ fontWeight: 700, color: '#1e40af', flex: 1 }}>{selectedMember.fullName}</span>
                  <button onClick={() => { setSelectedMember(null); setMemberQuery('') }}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder={t('spiritual.searchMember')}
                    value={memberQuery}
                    onChange={e => setMemberQuery(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                  {suggestions.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                      background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 2
                    }}>
                      {suggestions.map(s => (
                        <div key={s.id}
                          onClick={() => { setSelectedMember(s); setMemberQuery(''); setSuggestions([]) }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                          style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '0.9rem', borderBottom: '1px solid #f3f4f6' }}
                        >
                          {s.fullName}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Type / Date / Notes */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.82rem', fontWeight: 600, color: '#6b7280' }}>{t('spiritual.type')}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]).map(t => (
                    <button key={t} onClick={() => setSrType(t as typeof srType)} style={{
                      padding: '6px 14px', borderRadius: 6, border: `1px solid ${srType === t ? TYPE_META[t].border : '#d1d5db'}`,
                      cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                      background: srType === t ? TYPE_META[t].bg : 'white',
                      color: srType === t ? TYPE_META[t].color : '#374151',
                    }}>
                      {TYPE_META[t].icon} {TYPE_META[t].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.82rem', fontWeight: 600, color: '#6b7280' }}>{t('spiritual.date')}</label>
                <input type="date" value={srDate} onChange={e => setSrDate(e.target.value)}
                  style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.88rem' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.82rem', fontWeight: 600, color: '#6b7280' }}>{t('spiritual.notes')}</label>
                <input type="text" placeholder="اختياري" value={srNotes} onChange={e => setSrNotes(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
              <button onClick={saveRecord} disabled={srSaving || !selectedMember} style={{
                padding: '7px 24px', background: '#4f46e5', color: 'white',
                border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                opacity: srSaving || !selectedMember ? 0.6 : 1, whiteSpace: 'nowrap'
              }}>
                {srSaving ? '…' : t('spiritual.save')}
              </button>
            </div>

            {message && (
              <div style={{
                padding: '8px 14px', borderRadius: 6,
                background: message.startsWith('✓') ? '#f0fdf4' : '#fef2f2',
                color: message.startsWith('✓') ? '#166534' : '#dc2626',
                border: `1px solid ${message.startsWith('✓') ? '#86efac' : '#fca5a5'}`,
                fontSize: '0.88rem'
              }}>{message}</div>
            )}
          </div>
        )}

        {/* History */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{t('spiritual.recent')}</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['all', ...Object.keys(TYPE_META)] as const).map(f => (
                <button key={f} onClick={() => { setTypeFilter(f as typeof typeFilter); setPage(1) }} style={{
                  padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                  border: `1px solid ${typeFilter === f ? '#4f46e5' : '#d1d5db'}`,
                  background: typeFilter === f ? '#4f46e5' : 'white',
                  color: typeFilter === f ? 'white' : '#374151',
                }}>
                  {f === 'all' ? t('spiritual.all') : `${TYPE_META[f].icon} ${TYPE_META[f].label}`}
                </button>
              ))}
            </div>
          </div>

          {history.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem 0' }}>{t('spiritual.noRecords')}</p>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                      {[t('spiritual.date'), t('common.name'), t('spiritual.type'), t('spiritual.notes'), t('spiritual.recordedBy')].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                      {canDelete && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(r => {
                      const meta = TYPE_META[r.type]
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{new Date(r.date).toLocaleDateString('ar-EG')}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.memberName}</td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              padding: '3px 10px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 700,
                              background: meta?.bg ?? '#f3f4f6', color: meta?.color ?? '#374151',
                              border: `1px solid ${meta?.border ?? '#e5e7eb'}`
                            }}>
                              {meta?.icon} {meta?.label ?? r.type}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.notes || '—'}</td>
                          <td style={{ padding: '8px 12px', color: '#9ca3af', fontSize: '0.82rem' }}>{r.recordedByName || '—'}</td>
                          {canDelete && (
                            <td style={{ padding: '8px 12px' }}>
                              <button onClick={() => deleteRecord(r.id)} style={{
                                padding: '3px 10px', background: 'transparent', color: '#ef4444',
                                border: '1px solid #fca5a5', borderRadius: 5, fontSize: '0.78rem', cursor: 'pointer'
                              }}>{t('spiritual.delete')}</button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: 'white' }}>{t('common.prev')}</button>
                  <span style={{ alignSelf: 'center', fontSize: '0.88rem', color: '#6b7280' }}>{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: 'white' }}>{t('common.next')}</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
