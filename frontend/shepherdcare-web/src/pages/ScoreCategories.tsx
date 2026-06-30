import React, { useEffect, useState } from 'react'
import api from '../services/api'
import Header from '../components/Header'
import { useAuth } from '../auth'
import { useT } from '../i18n'

interface ScoreCategory {
  id: string
  name: string
  description?: string
  maxScore: number
  isPredefined: boolean
  classId?: string
  groupId?: string
  scope: 'global' | 'class' | 'group'
  createdAt: string
}

interface ScopeOption { id: string; label: string }

const EMPTY = { name: '', description: '', maxScore: 100, isPredefined: false, scopeType: 'global', classId: '', groupId: '' }

export default function ScoreCategoriesPage() {
  const auth = useAuth()
  const { t } = useT()
  const canManage = auth.hasRole('SuperAdmin') || auth.hasRole('ServiceLeader')

  const [categories, setCategories] = useState<ScoreCategory[]>([])
  const [classes, setClasses]       = useState<ScopeOption[]>([])
  const [groups, setGroups]         = useState<ScopeOption[]>([])
  const [loading, setLoading]       = useState(true)

  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<ScoreCategory | null>(null)
  const [form, setForm]             = useState({ ...EMPTY })
  const [saving, setSaving]         = useState(false)
  const [formErr, setFormErr]       = useState('')

  const [deleteTarget, setDeleteTarget] = useState<ScoreCategory | null>(null)
  const [deleting, setDeleting]         = useState(false)

  // Filter
  const [filterScope, setFilterScope] = useState<'all' | 'global' | 'class' | 'group'>('all')

  const load = () => {
    Promise.all([
      api.get<ScoreCategory[]>('/score-categories'),
      api.get<{ items: { id: string; className: string }[] }>('/classes', { params: { pageSize: 200 } }),
      api.get<{ id: string; name: string }[]>('/groups'),
    ]).then(([catRes, clsRes, grpRes]) => {
      setCategories(catRes.data)
      setClasses((clsRes.data.items ?? []).map(c => ({ id: c.id, label: c.className })))
      setGroups((grpRes.data ?? []).map(g => ({ id: g.id, label: g.name })))
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY })
    setFormErr('')
    setShowForm(true)
  }

  const openEdit = (cat: ScoreCategory) => {
    setEditing(cat)
    setForm({
      name: cat.name,
      description: cat.description ?? '',
      maxScore: cat.maxScore,
      isPredefined: cat.isPredefined,
      scopeType: cat.scope,
      classId: cat.classId ?? '',
      groupId: cat.groupId ?? '',
    })
    setFormErr('')
    setShowForm(true)
  }

  const save = async () => {
    if (!form.name.trim()) return setFormErr('Name is required.')
    if (form.maxScore < 1)  return setFormErr('Max score must be at least 1.')
    if (form.scopeType === 'class'  && !form.classId) return setFormErr('Select a class.')
    if (form.scopeType === 'group'  && !form.groupId) return setFormErr('Select a group.')
    setSaving(true); setFormErr('')
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || undefined,
        maxScore: form.maxScore,
        isPredefined: form.isPredefined,
        classId: form.scopeType === 'class' ? form.classId : undefined,
        groupId: form.scopeType === 'group' ? form.groupId : undefined,
      }
      if (editing) {
        const r = await api.put<ScoreCategory>(`/score-categories/${editing.id}`, payload)
        setCategories(prev => prev.map(c => c.id === editing.id ? { ...c, ...r.data } : c))
      } else {
        const r = await api.post<ScoreCategory>('/score-categories', payload)
        setCategories(prev => [...prev, r.data])
      }
      setShowForm(false)
    } catch (e: unknown) {
      const err = e as { response?: { data?: string | { title?: string } } }
      const raw = err?.response?.data
      setFormErr(typeof raw === 'string' ? raw : raw?.title ?? 'Failed to save category.')
    }
    setSaving(false)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/score-categories/${deleteTarget.id}`)
      setCategories(prev => prev.filter(c => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch { alert('Failed to delete.') }
    setDeleting(false)
  }

  const scopeBadge = (cat: ScoreCategory) => {
    if (cat.scope === 'class') {
      const cls = classes.find(c => c.id === cat.classId)
      return <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 10, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
        Class: {cls?.label ?? cat.classId}
      </span>
    }
    if (cat.scope === 'group') {
      const grp = groups.find(g => g.id === cat.groupId)
      return <span style={{ background: '#fef3c7', color: '#b45309', borderRadius: 10, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
        Group: {grp?.label ?? cat.groupId}
      </span>
    }
    return <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: 10, padding: '2px 8px', fontSize: '0.75rem' }}>Global</span>
  }

  const filtered = categories.filter(c => filterScope === 'all' || c.scope === filterScope)

  if (loading) return <div className="container"><p>{t('common.loading')}</p></div>

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <h2>{t('scoreCategories.title')}</h2>
          {canManage && <button className="btn-primary" onClick={openCreate}>{t('scoreCategories.newCategory')}</button>}
        </div>

        {/* Scope filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['all', 'global', 'class', 'group'] as const).map(s => (
            <button
              key={s}
              className={`btn-sm${filterScope === s ? ' btn-primary' : ''}`}
              onClick={() => setFilterScope(s)}
            >
              {s === 'all' ? t('scoreCategories.all') : s === 'global' ? t('scoreCategories.global') : s === 'class' ? t('scoreCategories.class') : t('scoreCategories.group')}
              <span style={{ marginLeft: 5, fontWeight: 400, opacity: 0.7 }}>
                ({categories.filter(c => s === 'all' || c.scope === s).length})
              </span>
            </button>
          ))}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('scoreCategories.scope')}</th>
              <th>{t('scoreCategories.description')}</th>
              <th style={{ width: 90, textAlign: 'center' }}>{t('scoreCategories.max')}</th>
              <th style={{ width: 110, textAlign: 'center' }}>{t('scoreCategories.predefined')}</th>
              {canManage && <th style={{ width: 130 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#888' }}>No categories.</td></tr>
            )}
            {filtered.map(cat => (
              <tr key={cat.id}>
                <td style={{ fontWeight: 600 }}>{cat.name}</td>
                <td>{scopeBadge(cat)}</td>
                <td style={{ color: '#64748b' }}>{cat.description ?? '—'}</td>
                <td style={{ textAlign: 'center' }}>{cat.maxScore}</td>
                <td style={{ textAlign: 'center' }}>
                  {cat.isPredefined
                    ? <span style={{ color: '#4f46e5', fontWeight: 700, fontSize: '0.8rem' }}>{t('scoreCategories.yes')}</span>
                    : <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>}
                </td>
                {canManage && (
                  <td>
                    <button className="btn-sm" onClick={() => openEdit(cat)} style={{ marginRight: 6 }}>{t('common.edit')}</button>
                    <button className="btn-sm btn-danger" onClick={() => setDeleteTarget(cat)}>{t('common.delete')}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Create / Edit modal */}
        {showForm && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{editing ? `${t('common.edit')} — ${editing.name}` : t('scoreCategories.newTitle')}</h3>

              <label>{t('scoreCategories.nameLabel')}</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. نشاط خاص"
                autoFocus
              />

              <label>{t('scoreCategories.description')}</label>
              <input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Short description"
              />

              <label>{t('scoreCategories.maxScore')}</label>
              <input
                type="number" min="1" max="1000"
                value={form.maxScore}
                onChange={e => setForm(p => ({ ...p, maxScore: parseInt(e.target.value) || 0 }))}
              />

              {/* Scope — only on create */}
              {!editing && (
                <>
                  <label>{t('scoreCategories.scopeLabel')}</label>
                  <select value={form.scopeType} onChange={e => setForm(p => ({ ...p, scopeType: e.target.value, classId: '', groupId: '' }))}>
                    <option value="global">{t('scoreCategories.globalScope')}</option>
                    <option value="class">{t('scoreCategories.specificClass')}</option>
                    <option value="group">{t('scoreCategories.specificGroup')}</option>
                  </select>

                  {form.scopeType === 'class' && (
                    <>
                      <label>{t('scoreCategories.classLabel')}</label>
                      <select value={form.classId} onChange={e => setForm(p => ({ ...p, classId: e.target.value }))}>
                        <option value="">{t('scoreCategories.selectClass')}</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </>
                  )}

                  {form.scopeType === 'group' && (
                    <>
                      <label>{t('scoreCategories.groupLabel')}</label>
                      <select value={form.groupId} onChange={e => setForm(p => ({ ...p, groupId: e.target.value }))}>
                        <option value="">{t('scoreCategories.selectGroup')}</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </select>
                    </>
                  )}
                </>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={form.isPredefined}
                  onChange={e => setForm(p => ({ ...p, isPredefined: e.target.checked }))}
                />
                {t('scoreCategories.predefinedLabel')}
              </label>

              {formErr && <div className="error" style={{ marginTop: 8 }}>{formErr}</div>}

              <div className="modal-actions">
                <button className="btn-primary" onClick={save} disabled={saving}>
                  {saving ? t('common.saving') : editing ? t('scoreCategories.saveChanges') : t('common.create')}
                </button>
                <button onClick={() => setShowForm(false)} disabled={saving}>{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{t('scoreCategories.deleteTitle')}</h3>
              <p>Delete <strong>{deleteTarget.name}</strong>? Existing score entries are not affected.</p>
              <div className="modal-actions">
                <button className="btn-danger" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? t('common.saving') : t('scoreCategories.deleteYes')}
                </button>
                <button onClick={() => setDeleteTarget(null)} disabled={deleting}>{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
