import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import Header from '../components/Header'
import SearchBox from '../components/SearchBox'
import Pagination from '../components/Pagination'
import { useAuth } from '../auth'
import { useT } from '../i18n'

interface ClassRow {
  id: string; className: string; ageGroup?: string
  minAge?: number; maxAge?: number
  groupId?: string; groupName?: string
  servantCount: number; memberCount: number
}
interface GroupOption { id: string; name: string }

export default function ClassesPage() {
  const [classes, setClasses]   = useState<ClassRow[]>([])
  const [groups, setGroups]     = useState<GroupOption[]>([])
  const [page, setPage]         = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [query, setQuery]       = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editClass, setEditClass] = useState<ClassRow | null>(null)
  const auth = useAuth()
  const { t } = useT()
  const canManage = auth.hasRole('SuperAdmin') || auth.hasRole('ServiceLeader')

  const [className, setClassName] = useState('')
  const [ageGroup, setAgeGroup]   = useState('')
  const [minAge, setMinAge]       = useState('')
  const [maxAge, setMaxAge]       = useState('')
  const [groupId, setGroupId]     = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving]       = useState(false)

  const load = () =>
    api.get<{ items: ClassRow[]; totalPages: number }>('/classes', {
      params: { q: query, groupId: filterGroup || undefined, page, pageSize: 20 }
    }).then(r => { setClasses(r.data.items); setTotalPages(r.data.totalPages) })
      .catch(() => setClasses([]))

  useEffect(() => { load() }, [query, filterGroup, page])
  useEffect(() => { api.get<GroupOption[]>('/groups').then(r => setGroups(r.data)).catch(() => {}) }, [])

  const openCreate = () => {
    setEditClass(null); setClassName(''); setAgeGroup(''); setMinAge(''); setMaxAge(''); setGroupId(''); setFormError(''); setShowForm(true)
  }
  const openEdit = (c: ClassRow) => {
    setEditClass(c); setClassName(c.className); setAgeGroup(c.ageGroup ?? '')
    setMinAge(c.minAge != null ? String(c.minAge) : '')
    setMaxAge(c.maxAge != null ? String(c.maxAge) : '')
    setGroupId(c.groupId ?? ''); setFormError(''); setShowForm(true)
  }

  const save = async () => {
    if (!className.trim()) return setFormError('Class name is required.')
    const minAgeNum = minAge !== '' ? parseInt(minAge, 10) : undefined
    const maxAgeNum = maxAge !== '' ? parseInt(maxAge, 10) : undefined
    if (minAgeNum != null && maxAgeNum != null && minAgeNum > maxAgeNum)
      return setFormError('Min age cannot be greater than max age.')
    setSaving(true); setFormError('')
    const payload = { className: className.trim(), ageGroup: ageGroup || undefined,
      minAge: minAgeNum, maxAge: maxAgeNum, groupId: groupId || undefined }
    try {
      if (editClass) {
        await api.put(`/classes/${editClass.id}`, payload)
        setClasses(prev => prev.map(c => c.id === editClass.id
          ? { ...c, className: className.trim(), ageGroup: ageGroup || undefined,
              minAge: minAgeNum, maxAge: maxAgeNum,
              groupId: groupId || undefined, groupName: groups.find(g => g.id === groupId)?.name } : c))
      } else {
        await api.post('/classes', payload)
        load()
      }
      setShowForm(false)
    } catch { setFormError('Failed to save class.') }
    finally { setSaving(false) }
  }

  const deleteClass = async (id: string) => {
    if (!confirm('Delete this class?')) return
    await api.delete(`/classes/${id}`)
    setClasses(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <h2>{t('classes.title')}</h2>
          {canManage && <button className="btn-primary" onClick={openCreate}>+ {t('classes.newClass')}</button>}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <SearchBox value={query} onChange={v => { setQuery(v); setPage(1) }} />
          <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setPage(1) }} style={{ minWidth: 160 }}>
            <option value="">{t('classes.form.none').replace('none', 'groups').replace('— —', 'All groups')}</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />

        <table className="table">
          <thead>
            <tr>
              <th>{t('classes.className')}</th>
              <th>{t('classes.ageGroup')}</th>
              <th>{t('classes.group')}</th>
              <th>{t('classes.servants')}</th>
              <th>{t('classes.members')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#888' }}>{t('classes.noClasses')}</td></tr>
            )}
            {classes.map(c => (
              <tr key={c.id}>
                <td><Link to={`/classes/${c.id}`} style={{ color: '#4f46e5', fontWeight: 600 }}>{c.className}</Link></td>
                <td>
                  {c.ageGroup ?? '—'}
                  {(c.minAge != null || c.maxAge != null) && (
                    <span style={{ marginLeft: 6, fontSize: 12, color: '#6366f1', fontWeight: 600 }}>
                      ({c.minAge ?? '?'}–{c.maxAge ?? '?'} yrs)
                    </span>
                  )}
                </td>
                <td>{c.groupName ?? '—'}</td>
                <td>{c.servantCount}</td>
                <td>{c.memberCount}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <Link to={`/classes/${c.id}`} className="btn-sm">{t('classes.manage')}</Link>
                  {canManage && <>
                    {' '}<button className="btn-sm" onClick={() => openEdit(c)} style={{ marginLeft: 4 }}>{t('common.edit')}</button>
                    <button className="btn-sm btn-danger" onClick={() => deleteClass(c.id)} style={{ marginLeft: 4 }}>{t('common.delete')}</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {showForm && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{editClass ? `${t('common.edit')} — ${editClass.className}` : t('classes.newClass')}</h3>
              <label>{t('classes.form.className')}</label>
              <input value={className} onChange={e => setClassName(e.target.value)} autoFocus />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>{t('classes.ageGroup')}</label>
                  <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)}>
                    <option value="">{t('classes.form.select')}</option>
                    {['Nursery','Kg','Primary','Preparatory','Secondary','University','Adults'].map(a =>
                      <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label>{t('classes.group')}</label>
                  <select value={groupId} onChange={e => setGroupId(e.target.value)}>
                    <option value="">{t('classes.form.none')}</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ fontWeight: 600, fontSize: 13, color: '#555' }}>
                  Age range <span style={{ fontWeight: 400, color: '#888' }}>(as of Sep 15 — for auto-enroll)</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
                  <div>
                    <label>Min age</label>
                    <input type="number" min={0} max={120} value={minAge}
                      onChange={e => setMinAge(e.target.value)} placeholder="e.g. 6" />
                  </div>
                  <div>
                    <label>Max age</label>
                    <input type="number" min={0} max={120} value={maxAge}
                      onChange={e => setMaxAge(e.target.value)} placeholder="e.g. 12" />
                  </div>
                </div>
              </div>
              {formError && <div className="error">{formError}</div>}
              <div className="modal-actions">
                <button className="btn-primary" onClick={save} disabled={saving}>
                  {saving ? t('common.saving') : editClass ? t('common.save') : t('common.create')}
                </button>
                <button onClick={() => setShowForm(false)} disabled={saving}>{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
