import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import Header from '../components/Header'
import { useAuth } from '../auth'
import { useT } from '../i18n'

interface UserOption { id: string; name: string }
interface GroupClass { id: string; className: string; ageGroup?: string; servantCount: number; memberCount: number }
interface Group {
  id: string; name: string
  servantUserId?: string; servantName?: string
  classes: GroupClass[]
}
interface ScoreCategory { id: string; name: string; maxScore: number }
interface ClassScore { rank: number; classId: string; className: string; totalScore: number; memberCount: number }

export default function GroupsPage() {
  const [groups, setGroups]       = useState<Group[]>([])
  const [users, setUsers]         = useState<UserOption[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editGroup, setEditGroup] = useState<Group | null>(null)
  const [name, setName]           = useState('')
  const [servantId, setServantId] = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const auth = useAuth()
  const { t } = useT()
  const canManage = auth.hasRole('SuperAdmin') || auth.hasRole('ServiceLeader')

  const [categories, setCategories]               = useState<ScoreCategory[]>([])
  const [expandedScores, setExpandedScores]       = useState<Record<string, boolean>>({})
  const [groupScores, setGroupScores]             = useState<Record<string, ClassScore[]>>({})
  const [groupScoreCategory, setGroupScoreCategory] = useState<Record<string, string>>({})
  const [groupScoreLoading, setGroupScoreLoading] = useState<Record<string, boolean>>({})
  const [groupCategories, setGroupCategories]     = useState<Record<string, ScoreCategory[]>>({})

  const loadGroupCategories = (groupId: string) => {
    if (groupCategories[groupId]) return
    api.get<ScoreCategory[]>('/score-categories', { params: { groupId } })
      .then(r => setGroupCategories(prev => ({ ...prev, [groupId]: r.data })))
      .catch(() => {})
  }

  const loadGroupLeaderboard = (groupId: string, catId?: string) => {
    setGroupScoreLoading(prev => ({ ...prev, [groupId]: true }))
    api.get<{ classes: ClassScore[] }>(`/scores/group/${groupId}/leaderboard`, {
      params: catId ? { categoryId: catId } : {}
    }).then(r => setGroupScores(prev => ({ ...prev, [groupId]: r.data.classes ?? [] })))
      .catch(() => setGroupScores(prev => ({ ...prev, [groupId]: [] })))
      .finally(() => setGroupScoreLoading(prev => ({ ...prev, [groupId]: false })))
  }

  const toggleScores = (groupId: string) => {
    const next = !expandedScores[groupId]
    setExpandedScores(prev => ({ ...prev, [groupId]: next }))
    if (next) {
      if (!groupScores[groupId]) loadGroupLeaderboard(groupId)
      loadGroupCategories(groupId)
    }
  }

  useEffect(() => {
    Promise.all([
      api.get<Group[]>('/groups'),
      api.get<{ items: { id: string; username: string; displayName?: string }[] }>('/users', { params: { pageSize: 200 } }),
      api.get<ScoreCategory[]>('/score-categories'),
    ]).then(([gRes, uRes, catRes]) => {
      setGroups(gRes.data)
      setUsers(uRes.data.items.map(u => ({ id: u.id, name: u.displayName ?? u.username })))
      setCategories(catRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const openCreate = () => { setEditGroup(null); setName(''); setServantId(''); setError(''); setShowForm(true) }
  const openEdit   = (g: Group) => { setEditGroup(g); setName(g.name); setServantId(g.servantUserId ?? ''); setError(''); setShowForm(true) }

  const save = async () => {
    if (!name.trim()) return setError('Name is required.')
    setSaving(true); setError('')
    try {
      const payload = { name: name.trim(), servantUserId: servantId || null }
      if (editGroup) {
        await api.put(`/groups/${editGroup.id}`, payload)
        setGroups(prev => prev.map(g => g.id === editGroup.id
          ? { ...g, name: name.trim(), servantUserId: servantId || undefined, servantName: users.find(u => u.id === servantId)?.name }
          : g))
      } else {
        const r = await api.post<Group>('/groups', payload)
        setGroups(prev => [...prev, { ...r.data, classes: [] }])
      }
      setShowForm(false)
    } catch { setError('Failed to save group.') }
    finally { setSaving(false) }
  }

  const deleteGroup = async (id: string) => {
    if (!confirm('Delete this group? Classes in it will be unassigned.')) return
    await api.delete(`/groups/${id}`)
    setGroups(prev => prev.filter(g => g.id !== id))
  }

  if (loading) return <div className="container"><p>{t('common.loading')}</p></div>

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <h2>{t('groups.title')}</h2>
          {canManage && <button className="btn-primary" onClick={openCreate}>{t('groups.newGroup')}</button>}
        </div>

        {groups.length === 0 && <p style={{ color: '#888' }}>{t('groups.noGroups')}</p>}

        {groups.map(g => (
          <div key={g.id} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0 }}>{g.name}</h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 2 }}>
                  {t('groups.servant')}: <strong>{g.servantName ?? t('groups.unassigned')}</strong>
                  &ensp;·&ensp; {g.classes.length} class{g.classes.length !== 1 ? 'es' : ''}
                </div>
              </div>
              {canManage && <>
                <button className="btn-sm" onClick={() => openEdit(g)}>{t('common.edit')}</button>
                <button className="btn-sm btn-danger" onClick={() => deleteGroup(g.id)}>{t('common.delete')}</button>
              </>}
            </div>

            {g.classes.length > 0 && (
              <table className="table" style={{ marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th>{t('classes.className')}</th>
                    <th>{t('classes.ageGroup')}</th>
                    <th>{t('classes.servants')}</th>
                    <th>{t('classes.members')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {g.classes.map(c => (
                    <tr key={c.id}>
                      <td><Link to={`/classes/${c.id}`} style={{ color: '#4f46e5', fontWeight: 600 }}>{c.className}</Link></td>
                      <td>{c.ageGroup ?? '—'}</td>
                      <td>{c.servantCount}</td>
                      <td>{c.memberCount}</td>
                      <td><Link to={`/classes/${c.id}`} className="btn-sm">{t('classes.manage')}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Group score leaderboard */}
            {g.classes.length > 0 && (
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                <button
                  className="btn-sm"
                  onClick={() => toggleScores(g.id)}
                  style={{ marginBottom: expandedScores[g.id] ? 10 : 0 }}
                >
                  {expandedScores[g.id] ? t('classDetail.leaderboard') : t('classDetail.showLeaderboard')}
                </button>

                {expandedScores[g.id] && (
                  <div>
                    <div style={{ marginBottom: 10 }}>
                      <select
                        value={groupScoreCategory[g.id] ?? ''}
                        onChange={e => {
                          const catId = e.target.value
                          setGroupScoreCategory(prev => ({ ...prev, [g.id]: catId }))
                          loadGroupLeaderboard(g.id, catId || undefined)
                        }}
                        style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                      >
                        <option value="">{t('scores.allCategories')}</option>
                        {(groupCategories[g.id] ?? categories).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    {groupScoreLoading[g.id] ? (
                      <p style={{ color: '#888', fontSize: '0.85rem' }}>{t('common.loading')}</p>
                    ) : !groupScores[g.id]?.length ? (
                      <p style={{ color: '#aaa', fontStyle: 'italic', fontSize: '0.85rem' }}>{t('scores.noScores')}</p>
                    ) : (
                      <table className="table">
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>{t('scores.rank')}</th>
                            <th>{t('classes.className')}</th>
                            <th style={{ width: 80 }}>{t('classes.members')}</th>
                            <th style={{ width: 100, textAlign: 'right' }}>{t('scores.total')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupScores[g.id].map(row => (
                            <tr key={row.classId}>
                              <td style={{ fontWeight: 700, color: row.rank === 1 ? '#f59e0b' : row.rank === 2 ? '#94a3b8' : row.rank === 3 ? '#b45309' : '#374151' }}>
                                {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank}
                              </td>
                              <td><Link to={`/classes/${row.classId}`} style={{ color: '#4f46e5', fontWeight: 500 }}>{row.className}</Link></td>
                              <td>{row.memberCount}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>{row.totalScore}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Create / Edit modal */}
        {showForm && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{editGroup ? `${t('common.edit')} — ${editGroup.name}` : t('groups.newGroup').replace('+ ', '')}</h3>
              <label>Group name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Youth Group" autoFocus />
              <label>Assigned servant</label>
              <select value={servantId} onChange={e => setServantId(e.target.value)}>
                <option value="">{t('classes.form.none')}</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {error && <div className="error">{error}</div>}
              <div className="modal-actions">
                <button className="btn-primary" onClick={save} disabled={saving}>
                  {saving ? t('common.saving') : editGroup ? t('common.save') : t('common.create')}
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
