import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Header from '../components/Header'
import api from '../services/api'

interface Task {
  id: string
  title: string
  notes?: string
  dueDate?: string
  status: 'Open' | 'Done' | 'Cancelled'
  assignedToUserId: string
  assignedToName?: string
  relatedMemberId?: string
  relatedMemberName?: string
  relatedVisitId?: string
  createdAt: string
  completedAt?: string
  isOverdue: boolean
}

interface UserOption { id: string; username: string; displayName?: string }

function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
}

const STATUS_AR: Record<string, string> = { Open: 'مفتوحة', Done: 'منجزة', Cancelled: 'ملغاة' }
const STATUS_COLOR: Record<string, string> = { Open: '#0891b2', Done: '#059669', Cancelled: '#94a3b8' }

const EMPTY_FORM = { title: '', notes: '', dueDate: '', assignedToUserId: '', relatedMemberId: '', relatedVisitId: '' }

export default function FollowUpTasksPage() {
  const auth = useAuth()
  const canAdmin = auth.hasRole('SuperAdmin') || auth.hasRole('ServiceLeader') ||
    auth.hasRole('Priest') || auth.hasRole('SeniorPriest')
  const canCreate = canAdmin || auth.hasRole('Servant') || auth.hasRole('DataEntry')

  const [tasks, setTasks]   = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'Open' | 'Done' | 'Cancelled' | 'all'>('Open')
  const [myOnly, setMyOnly] = useState(false)
  const [users, setUsers]   = useState<UserOption[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]     = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      if (myOnly) params.set('assignedToMe', 'true')
      const res = await api.get<Task[]>(`/tasks?${params}`)
      setTasks(res.data)
    } finally {
      setLoading(false)
    }
  }, [filter, myOnly])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (canAdmin) {
      api.get<UserOption[]>('/api/users').then(r => setUsers(r.data)).catch(() => {})
    }
  }, [canAdmin])

  async function createTask() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await api.post('/tasks', {
        title: form.title.trim(),
        notes: form.notes || null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        assignedToUserId: form.assignedToUserId || auth.user?.id,
        relatedMemberId: form.relatedMemberId || null,
        relatedVisitId: form.relatedVisitId || null,
      })
      setShowForm(false)
      setForm({ ...EMPTY_FORM })
      load()
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: 'Open' | 'Done' | 'Cancelled') {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    await api.put(`/tasks/${id}`, { title: task.title, notes: task.notes, dueDate: task.dueDate, status })
    load()
  }

  async function deleteTask(id: string) {
    if (!confirm('حذف هذه المهمة؟')) return
    await api.delete(`/tasks/${id}`)
    load()
  }

  return (
    <div className="page-layout">
      <Header />
      <main className="page-main" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>مهام المتابعة</h1>
          {canCreate && (
            <button className="btn-primary" style={{ marginInlineStart: 'auto' }} onClick={() => setShowForm(true)}>
              + مهمة جديدة
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {(['Open', 'Done', 'Cancelled', 'all'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '0.3rem 0.9rem', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.85rem',
              background: filter === s ? '#6366f1' : '#f1f5f9',
              color: filter === s ? '#fff' : '#475569', fontWeight: filter === s ? 600 : 400,
            }}>
              {s === 'all' ? 'الكل' : STATUS_AR[s]}
            </button>
          ))}
          {canAdmin && (
            <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 6, marginInlineStart: '0.5rem' }}>
              <input type="checkbox" checked={myOnly} onChange={e => setMyOnly(e.target.checked)} />
              مخصصة لي فقط
            </label>
          )}
        </div>

        {loading && <div style={{ color: '#6366f1', marginBottom: '1rem' }}>جاري التحميل…</div>}

        {tasks.length === 0 && !loading && (
          <div style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>لا توجد مهام</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {tasks.map(task => (
            <div key={task.id} style={{
              background: '#fff', borderRadius: 10, padding: '1rem 1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,.07)',
              borderInlineStart: `4px solid ${task.isOverdue ? '#dc2626' : STATUS_COLOR[task.status]}`,
              opacity: task.status !== 'Open' ? 0.7 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>{task.title}</div>
                  {task.notes && <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 3 }}>{task.notes}</div>}
                  <div style={{ fontSize: '0.78rem', color: task.isOverdue ? '#dc2626' : '#94a3b8', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {task.dueDate && <span>📅 {formatDate(task.dueDate)}{task.isOverdue ? ' — متأخرة' : ''}</span>}
                    {task.assignedToName && <span>👤 {task.assignedToName}</span>}
                    {task.relatedMemberName && (
                      <span>🔗 <Link to={`/members/${task.relatedMemberId}`} style={{ color: '#6366f1' }}>{task.relatedMemberName}</Link></span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '0.72rem', padding: '2px 8px', borderRadius: 20,
                    background: STATUS_COLOR[task.status] + '22', color: STATUS_COLOR[task.status], fontWeight: 600,
                  }}>{STATUS_AR[task.status]}</span>
                  {task.status === 'Open' && (
                    <button onClick={() => updateStatus(task.id, 'Done')} title="إنجاز" style={{
                      background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 6,
                      padding: '3px 8px', cursor: 'pointer', fontSize: '0.8rem',
                    }}>✓ إنجاز</button>
                  )}
                  {canAdmin && (
                    <button onClick={() => deleteTask(task.id)} title="حذف" style={{
                      background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6,
                      padding: '3px 6px', cursor: 'pointer', fontSize: '0.8rem',
                    }}>🗑</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Create form modal */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', width: '90%', maxWidth: 460 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>مهمة متابعة جديدة</h2>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  العنوان *
                  <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </label>
                <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  ملاحظات
                  <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </label>
                <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  تاريخ الاستحقاق
                  <input type="date" className="form-input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </label>
                {canAdmin && users.length > 0 && (
                  <label style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    مسند إلى
                    <select className="form-input" value={form.assignedToUserId} onChange={e => setForm(f => ({ ...f, assignedToUserId: e.target.value }))}>
                      <option value="">أنا (المستخدم الحالي)</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.displayName ?? u.username}</option>)}
                    </select>
                  </label>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setShowForm(false)}>إلغاء</button>
                  <button className="btn-primary" onClick={createTask} disabled={saving}>
                    {saving ? 'جاري الحفظ…' : 'حفظ'}
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
