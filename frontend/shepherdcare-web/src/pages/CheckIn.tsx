import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../auth'
import Header from '../components/Header'
import api from '../services/api'
import QRScanner from '../components/QRScanner'
import { useT } from '../i18n'

interface SearchResult {
  id: string
  fullName: string
  familyName: string
  checkedInMass: boolean
  checkedInSchool: boolean
}

interface CheckInRecord {
  id: string
  memberId: string
  memberName: string
  familyName: string
  attendanceType: string
  checkedInAt: string
}

const TYPE_LABELS: Record<string, string> = {
  Mass: '⛪ القداس',
  SundaySchool: '📚 مدارس الأحد',
}

export default function CheckInPage() {
  const { user } = useAuth()
  const { t } = useT()
  const typeLabel = (type: string) => type === 'Mass' ? t('checkin.mass' as any) : t('checkin.sundaySchool' as any)
  const [type, setType] = useState<'Mass' | 'SundaySchool'>('Mass')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [todayRecords, setTodayRecords] = useState<CheckInRecord[]>([])
  const [searching, setSearching] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => { loadToday() }, [type])

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    if (query.length < 2) { setResults([]); return }
    searchRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.get<SearchResult[]>('/checkin/search', { params: { q: query } })
        setResults(r.data)
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
  }, [query])

  const loadToday = async () => {
    try {
      const r = await api.get<CheckInRecord[]>('/checkin/today', { params: { type } })
      setTodayRecords(r.data)
    } catch { setTodayRecords([]) }
  }

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const checkIn = async (member: SearchResult) => {
    try {
      await api.post('/checkin', { memberId: member.id, type })
      showToast(t('checkin.checkedIn' as any, { name: member.fullName }), true)
      setQuery(''); setResults([])
      loadToday()
      inputRef.current?.focus()
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) showToast(t('checkin.alreadyRegistered' as any, { name: member.fullName }), false)
      else showToast(t('checkin.error' as any), false)
    }
  }

  // Called by QRScanner with a scanned UUID
  const handleQRScan = async (memberId: string) => {
    try {
      const r = await api.post<{ memberName: string; attendanceType: string }>('/checkin', { memberId, type })
      showToast(t('checkin.checkedIn' as any, { name: r.data.memberName }), true)
      loadToday()
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { message?: string } } })?.response
      if (resp?.status === 409) showToast(t('checkin.alreadyRegistered' as any, { name: '' }), false)
      else if (resp?.status === 404) showToast(t('checkin.memberNotFound' as any), false)
      else showToast(t('checkin.error' as any), false)
    }
  }

  const undoCheckIn = async (id: string) => {
    try {
      await api.delete(`/checkin/${id}`)
      loadToday()
    } catch { showToast(t('checkin.undoError' as any), false) }
  }

  const todayFiltered = todayRecords.filter(r => r.attendanceType === type)

  return (
    <div>
      <Header />
      <div className="container">

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            background: toast.ok ? '#16a34a' : '#dc2626',
            color: '#fff', padding: '12px 20px', borderRadius: 10,
            fontWeight: 600, fontSize: 15, boxShadow: '0 4px 12px rgba(0,0,0,.25)',
            animation: 'fadeIn .2s ease',
          }}>{toast.msg}</div>
        )}

        <div className="page-header">
          <h2 style={{ margin: 0 }}>{t('checkin.title' as any)}</h2>
        </div>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {(['Mass', 'SundaySchool'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: '14px 0', fontSize: 16, fontWeight: 700,
              border: '2px solid', borderRadius: 12, cursor: 'pointer',
              borderColor: type === t ? '#6366f1' : '#e5e7eb',
              background: type === t ? '#6366f1' : '#fff',
              color: type === t ? '#fff' : '#6b7280',
              transition: 'all .15s',
            }}>{typeLabel(t)}</button>
          ))}
        </div>

        {/* Search + QR button row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('checkin.searchPlaceholder' as any)}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '14px 16px', fontSize: 16,
                border: '2px solid #e2e8f0', borderRadius: 12, outline: 'none',
                background: '#f9fafb',
              }}
              onFocus={e => (e.target.style.borderColor = '#6366f1')}
              onBlur={e  => (e.target.style.borderColor = '#e2e8f0')}
            />
            {searching && (
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14 }}>جارٍ البحث…</span>
            )}
          </div>
          <button onClick={() => setShowScanner(true)} style={{
            flexShrink: 0, padding: '12px 18px', fontSize: 22,
            background: '#6366f1', color: '#fff', border: 'none',
            borderRadius: 12, cursor: 'pointer', lineHeight: 1,
            boxShadow: '0 2px 8px rgba(99,102,241,.3)',
          }} title="مسح رمز QR">
            📷
          </button>
        </div>

        {/* Search results dropdown */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          {searching && (
            <span style={{ color: '#9ca3af', fontSize: 13 }}>جارٍ البحث…</span>
          )}

          {results.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden', marginTop: 4,
            }}>
              {results.map(m => {
                const alreadyIn = type === 'Mass' ? m.checkedInMass : m.checkedInSchool
                return (
                  <div key={m.id} onClick={() => !alreadyIn && checkIn(m)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', cursor: alreadyIn ? 'default' : 'pointer',
                      background: alreadyIn ? '#f0fdf4' : '#fff',
                      borderBottom: '1px solid #f3f4f6',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e => { if (!alreadyIn) (e.currentTarget as HTMLDivElement).style.background = '#f5f3ff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = alreadyIn ? '#f0fdf4' : '#fff' }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: '#1f2937' }}>{m.fullName}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{m.familyName}</div>
                    </div>
                    {alreadyIn
                      ? <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{t('checkin.registered' as any)}</span>
                      : <span style={{ background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, padding: '6px 14px', borderRadius: 8 }}>{t('checkin.register' as any)}</span>
                    }
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Today's check-ins */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>
              {t('checkin.todayAttendance' as any)} — {typeLabel(type)}
              <span style={{ marginInlineStart: 10, background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>
                {todayFiltered.length}
              </span>
            </h3>
            <button onClick={loadToday} style={{
              background: 'none', border: '1px solid #e5e7eb', borderRadius: 8,
              padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: '#6b7280',
            }}>{t('checkin.refresh' as any)}</button>
          </div>

          {todayFiltered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <div>{t('checkin.noAttendance' as any)}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {todayFiltered.map(r => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: '#f0fdf4', borderRadius: 8,
                  border: '1px solid #bbf7d0',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#15803d' }}>{r.memberName}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      {new Date(r.checkedInAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button onClick={() => undoCheckIn(r.id)} title="تراجع" style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#dc2626', fontSize: 16, padding: '2px 4px', lineHeight: 1,
                  }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QR info tip */}
        <div style={{ marginTop: 20, padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: 13, color: '#1d4ed8' }}>
          {t('checkin.qrTip' as any)}
        </div>

        {/* QR Scanner overlay */}
        {showScanner && (
          <QRScanner
            onScan={memberId => { handleQRScan(memberId) }}
            onClose={() => setShowScanner(false)}
          />
        )}
      </div>
    </div>
  )
}
