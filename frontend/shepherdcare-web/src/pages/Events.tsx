import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth'
import Header from '../components/Header'
import api from '../services/api'
import { getFeastsForMonth } from '../utils/copticFeasts'
import { useT } from '../i18n'

interface CalEvent {
  id: string
  title: string
  description?: string
  type: string
  startDateTime: string
  endDateTime?: string
  location?: string
  classId?: string
  groupId?: string
  isRecurring: boolean
  recurrenceType: string
  attendanceCount: number
  createdByName?: string
}

const EVENT_TYPES = ['Mass', 'Meeting', 'Trip', 'Service', 'Other']
const TYPE_AR: Record<string, string> = {
  Mass: 'قداس', Meeting: 'اجتماع', Trip: 'رحلة', Service: 'خدمة', Other: 'أخرى',
}
const TYPE_COLOR: Record<string, string> = {
  Mass: '#7c3aed', Meeting: '#0891b2', Trip: '#d97706', Service: '#059669', Other: '#6b7280',
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('ar-EG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}
function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
}

const EMPTY_FORM = {
  title: '', description: '', type: 'Meeting', startDateTime: '', endDateTime: '',
  location: '', isRecurring: false, recurrenceType: 'None',
}

export default function EventsPage() {
  const auth = useAuth()
  const { t } = useT()
  const typeAr = (type: string) => (t as any)(`eventType.${type}`) as string
  const canWrite = auth.hasRole('SuperAdmin') || auth.hasRole('ServiceLeader') ||
    auth.hasRole('Priest') || auth.hasRole('SeniorPriest') || auth.hasRole('Servant') ||
    auth.hasRole('DataEntry')

  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-based
  const [view, setView]   = useState<'calendar' | 'list'>('calendar')
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<CalEvent | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const monthStr = `${year}-${String(month).padStart(2, '0')}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<CalEvent[]>(`/events?month=${monthStr}`)
      setEvents(res.data)
    } finally {
      setLoading(false)
    }
  }, [monthStr])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  async function save() {
    if (!form.title.trim() || !form.startDateTime) return
    setSaving(true)
    try {
      const body = {
        ...form,
        startDateTime: new Date(form.startDateTime).toISOString(),
        endDateTime: form.endDateTime ? new Date(form.endDateTime).toISOString() : null,
      }
      if (editId) await api.put(`/events/${editId}`, body)
      else await api.post('/events', body)
      setShowForm(false)
      setForm({ ...EMPTY_FORM })
      setEditId(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm(t('events.confirmDelete' as any))) return
    await api.delete(`/events/${id}`)
    setSelected(null)
    load()
  }

  function openEdit(ev: CalEvent) {
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      type: ev.type,
      startDateTime: ev.startDateTime.slice(0, 16),
      endDateTime: ev.endDateTime ? ev.endDateTime.slice(0, 16) : '',
      location: ev.location ?? '',
      isRecurring: ev.isRecurring,
      recurrenceType: ev.recurrenceType,
    })
    setEditId(ev.id)
    setSelected(null)
    setShowForm(true)
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsByDay: Record<number, CalEvent[]> = {}
  events.forEach(ev => {
    const d = new Date(ev.startDateTime).getDate()
    if (!eventsByDay[d]) eventsByDay[d] = []
    eventsByDay[d].push(ev)
  })

  const [showFeasts, setShowFeasts] = useState(true)
  const feastsByDay = showFeasts ? getFeastsForMonth(year, month) : {}

  const monthNames = Array.from({length:12},(_,i) => (t as any)(`month.${i+1}`) as string)
  const dayNames   = Array.from({length:7}, (_,i) => (t as any)(`weekday.${i}`) as string)

  return (
    <div className="page-layout">
      <Header />
      <main className="page-main" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{t('events.title' as any)}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', marginInlineStart: 'auto' }}>
            <button className="btn-secondary" onClick={() => setView(view === 'calendar' ? 'list' : 'calendar')}>
              {view === 'calendar' ? t('events.listView' as any) : t('events.calendarView' as any)}
            </button>
            <button className="btn-secondary" onClick={() => setShowFeasts(f => !f)}>
              {showFeasts ? t('events.hideFeasts' as any) : t('events.showFeasts' as any)}
            </button>
            {canWrite && (
              <button className="btn-primary" onClick={() => { setForm({ ...EMPTY_FORM }); setEditId(null); setShowForm(true) }}>
                {t('events.newEvent' as any)}
              </button>
            )}
          </div>
        </div>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <button className="btn-secondary" onClick={prevMonth}>‹</button>
          <span style={{ fontWeight: 600, fontSize: '1.1rem', minWidth: 140, textAlign: 'center' }}>
            {monthNames[month - 1]} {year}
          </span>
          <button className="btn-secondary" onClick={nextMonth}>›</button>
        </div>

        {loading && <div style={{ color: '#6366f1', marginBottom: '1rem' }}>جاري التحميل…</div>}

        {view === 'calendar' ? (
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {dayNames.map(d => (
                <div key={d} style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>{d}</div>
              ))}
            </div>
            {/* Cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((day, i) => {
                const isToday = day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear()
                const dayEvents = day ? (eventsByDay[day] ?? []) : []
                const dayFeasts = day ? (feastsByDay[day] ?? []) : []
                const hasFeast  = dayFeasts.length > 0
                return (
                  <div key={i} style={{
                    minHeight: 90, padding: '0.35rem', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9',
                    background: isToday ? '#eff6ff' : hasFeast ? '#fdf8ff' : day ? '#fff' : '#fafafa',
                  }}>
                    {day && (
                      <>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.8rem', fontWeight: isToday ? 700 : 400,
                          background: isToday ? '#6366f1' : 'transparent', color: isToday ? '#fff' : '#334155',
                          marginBottom: '0.2rem',
                        }}>{day}</div>
                        {dayFeasts.map((f, fi) => (
                          <div key={`f${fi}`} title={f.nameAr} style={{
                            fontSize: '0.68rem', padding: '1px 4px', borderRadius: 3, marginBottom: 2,
                            background: f.type === 'major' ? '#fce7f3' : f.type === 'fast' ? '#fff7ed' : '#f0fdf4',
                            color: f.type === 'major' ? '#be185d' : f.type === 'fast' ? '#c2410c' : '#15803d',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600,
                          }}>
                            {f.nameAr}
                          </div>
                        ))}
                        {dayEvents.slice(0, 3).map(ev => (
                          <div key={ev.id} onClick={() => setSelected(ev)} style={{
                            fontSize: '0.7rem', padding: '1px 4px', borderRadius: 3, marginBottom: 2,
                            background: TYPE_COLOR[ev.type] + '22', color: TYPE_COLOR[ev.type],
                            cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            fontWeight: 500,
                          }}>
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>+{dayEvents.length - 3} أخرى</div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {events.length === 0 && !loading && (
              <div style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>{t('events.noEvents' as any)}</div>
            )}
            {events.map(ev => (
              <div key={ev.id} onClick={() => setSelected(ev)} style={{
                background: '#fff', borderRadius: 10, padding: '1rem 1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,.07)', cursor: 'pointer',
                borderInlineStart: `4px solid ${TYPE_COLOR[ev.type]}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{ev.title}</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    {formatDate(ev.startDateTime)} — {formatTime(ev.startDateTime)}
                    {ev.location && ` · ${ev.location}`}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.72rem', padding: '2px 8px', borderRadius: 20,
                  background: TYPE_COLOR[ev.type] + '22', color: TYPE_COLOR[ev.type], fontWeight: 600,
                }}>{typeAr(ev.type)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Event detail modal */}
        {selected && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', width: '90%', maxWidth: 480 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{selected.title}</h2>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>
                <div><b>النوع:</b> {typeAr(selected.type)}</div>
                <div><b>البداية:</b> {formatDate(selected.startDateTime)} {formatTime(selected.startDateTime)}</div>
                {selected.endDateTime && <div><b>النهاية:</b> {formatDate(selected.endDateTime)} {formatTime(selected.endDateTime)}</div>}
                {selected.location && <div><b>المكان:</b> {selected.location}</div>}
                {selected.description && <div><b>الوصف:</b> {selected.description}</div>}
                {selected.isRecurring && <div><b>متكرر:</b> {selected.recurrenceType === 'Weekly' ? 'أسبوعي' : 'شهري'}</div>}
                <div><b>الحضور المسجل:</b> {selected.attendanceCount}</div>
                {selected.createdByName && <div><b>أنشأه:</b> {selected.createdByName}</div>}
              </div>
              {canWrite && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => openEdit(selected)}>{t('common.edit')}</button>
                  <button style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '0.4rem 1rem', cursor: 'pointer' }}
                    onClick={() => deleteEvent(selected.id)}>{t('common.delete')}</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create / Edit form modal */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', width: '90%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{editId ? t('events.editEvent' as any) : t('events.newEvent' as any)}</h2>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {t('events.eventTitle' as any)}
                  <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </label>
                <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {t('events.type' as any)}
                  <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {EVENT_TYPES.map(et => <option key={et} value={et}>{typeAr(et)}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {t('events.startTime' as any)}
                  <input type="datetime-local" className="form-input" value={form.startDateTime} onChange={e => setForm(f => ({ ...f, startDateTime: e.target.value }))} />
                </label>
                <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {t('events.endTime' as any)}
                  <input type="datetime-local" className="form-input" value={form.endDateTime} onChange={e => setForm(f => ({ ...f, endDateTime: e.target.value }))} />
                </label>
                <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {t('events.location' as any)}
                  <input className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </label>
                <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {t('events.description' as any)}
                  <textarea className="form-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </label>
                <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.isRecurring} onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))} />
                  {t('events.recurring' as any)}
                </label>
                {form.isRecurring && (
                  <select className="form-input" value={form.recurrenceType} onChange={e => setForm(f => ({ ...f, recurrenceType: e.target.value }))}>
                    <option value="Weekly">{t('events.weekly' as any)}</option>
                    <option value="Monthly">{t('events.monthly' as any)}</option>
                  </select>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button className="btn-secondary" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
                  <button className="btn-primary" onClick={save} disabled={saving}>
                    {saving ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
