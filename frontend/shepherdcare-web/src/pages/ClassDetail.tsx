import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../services/api'
import Header from '../components/Header'
import { useAuth } from '../auth'
import { useT } from '../i18n'

interface ServantRow   { id: string; userId: string; name: string }
interface MemberRow    { id: string; memberId: string; fullName: string; gender?: string; relation?: string; academicYear: string }
interface UserOption   { id: string; name: string }
interface MemberOption { id: string; fullName: string; familyName?: string }

interface ClassDetail {
  id: string; className: string; ageGroup?: string; minAge?: number; maxAge?: number; gender?: string
  groupId?: string; groupName?: string
  servants: ServantRow[]; members: MemberRow[]
}

interface ScoreCategory { id: string; name: string; maxScore: number; isPredefined: boolean }
interface LeaderboardEntry { rank: number; memberId: string; memberName: string; photoUrl?: string; totalScore: number; count: number }

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const auth = useAuth()
  const { t } = useT()
  const canManage    = auth.hasRole('SuperAdmin') || auth.hasRole('ServiceLeader')
  const canAutoEnroll = canManage || auth.hasRole('Priest') || auth.hasRole('SeniorPriest')
  const canEnroll = canManage || auth.hasRole('DataEntry')
  const canScore  = canManage || auth.hasRole('Servant') || auth.hasRole('DataEntry')

  const [cls, setCls]           = useState<ClassDetail | null>(null)
  const [loading, setLoading]   = useState(true)

  const [users, setUsers]             = useState<UserOption[]>([])
  const [addServantId, setAddServantId] = useState('')
  const [servantErr, setServantErr]   = useState('')
  const [servantSaving, setServantSaving] = useState(false)

  const [memberSearch, setMemberSearch] = useState('')
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [addMemberId, setAddMemberId]   = useState('')
  const [memberErr, setMemberErr]       = useState('')
  const [memberSaving, setMemberSaving] = useState(false)

  const [categories, setCategories]         = useState<ScoreCategory[]>([])
  const [leaderboard, setLeaderboard]       = useState<LeaderboardEntry[]>([])
  const [lbLoading, setLbLoading]           = useState(false)
  const [lbCategory, setLbCategory]         = useState('')
  const [scoreTab, setScoreTab]             = useState<'leaderboard' | 'add'>('leaderboard')
  const [scoreMemberId, setScoreMemberId]   = useState('')
  const [scoreCategoryId, setScoreCategoryId] = useState('')
  const [scoreValue, setScoreValue]         = useState('')
  const [scoreDate, setScoreDate]           = useState(new Date().toISOString().slice(0, 10))
  const [scoreDesc, setScoreDesc]           = useState('')
  const [scoreErr, setScoreErr]             = useState('')
  const [scoreSaving, setScoreSaving]       = useState(false)
  const [scoreSuccess, setScoreSuccess]     = useState('')

  const [autoEnrolling, setAutoEnrolling]   = useState(false)
  const [autoEnrollMsg, setAutoEnrollMsg]   = useState('')

  const loadLeaderboard = useCallback((catId?: string) => {
    if (!id) return
    setLbLoading(true)
    api.get<{ members: LeaderboardEntry[] }>(`/scores/class/${id}/leaderboard`, {
      params: catId ? { categoryId: catId } : {}
    }).then(r => setLeaderboard(r.data.members ?? []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLbLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<ClassDetail>(`/classes/${id}`),
      canManage
        ? api.get<{ id: string; name: string }[]>('/users/servant-options')
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      api.get<ScoreCategory[]>('/score-categories', { params: { classId: id } }),
    ]).then(([cRes, uRes, catRes]) => {
      setCls(cRes.data)
      setUsers(uRes.data as { id: string; name: string }[])
      setCategories(catRes.data)
    }).catch(() => setLoading(false))
      .finally(() => setLoading(false))
    loadLeaderboard()
  }, [id])

  useEffect(() => { loadLeaderboard(lbCategory || undefined) }, [lbCategory, loadLeaderboard])

  useEffect(() => {
    if (memberSearch.length < 2) { setMemberOptions([]); return }
    api.get<{ items: { id: string; fullName: string }[] }>('/members/search', { params: { q: memberSearch, pageSize: 20 } })
      .then(r => setMemberOptions(r.data.items ?? []))
      .catch(() => setMemberOptions([]))
  }, [memberSearch])

  const addServant = async () => {
    if (!addServantId) return setServantErr('Select a user.')
    setServantSaving(true); setServantErr('')
    try {
      const r = await api.post<ServantRow>(`/classes/${id}/servants`, { userId: addServantId })
      setCls(prev => prev ? { ...prev, servants: [...prev.servants, r.data] } : prev)
      setAddServantId('')
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      setServantErr(status === 409 ? 'Already a servant for this class.' : 'Failed to add servant.')
    }
    setServantSaving(false)
  }

  const removeServant = async (servantId: string) => {
    await api.delete(`/classes/${id}/servants/${servantId}`)
    setCls(prev => prev ? { ...prev, servants: prev.servants.filter(s => s.id !== servantId) } : prev)
  }

  const enrollMember = async () => {
    if (!addMemberId) return setMemberErr('Select a member.')
    setMemberSaving(true); setMemberErr('')
    try {
      const r = await api.post<MemberRow>(`/classes/${id}/members`, { memberId: addMemberId })
      setCls(prev => prev ? { ...prev, members: [...prev.members, r.data] } : prev)
      setAddMemberId(''); setMemberSearch('')
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      setMemberErr(status === 409 ? 'Member is already enrolled.' : 'Failed to enroll member.')
    }
    setMemberSaving(false)
  }

  const removeMember = async (enrollmentId: string) => {
    await api.delete(`/classes/${id}/members/${enrollmentId}`)
    setCls(prev => prev ? { ...prev, members: prev.members.filter(m => m.id !== enrollmentId) } : prev)
  }

  const autoEnroll = async () => {
    if (!confirm(`Auto-enroll all members aged ${cls?.minAge}–${cls?.maxAge} (as of Sep 15)?`)) return
    setAutoEnrolling(true); setAutoEnrollMsg('')
    try {
      const r = await api.post<{ enrolled: number; skipped: number; message: string }>(`/classes/${id}/auto-enroll`)
      setAutoEnrollMsg(r.data.message)
      // Reload members list
      const updated = await api.get<ClassDetail>(`/classes/${id}`)
      setCls(updated.data)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { title?: string } } })?.response?.data?.title
      setAutoEnrollMsg(msg ?? 'Auto-enroll failed.')
    }
    setAutoEnrolling(false)
  }

  const submitScore = async () => {
    if (!scoreMemberId)   return setScoreErr('Select a member.')
    if (!scoreCategoryId) return setScoreErr('Select a category.')
    const val = parseInt(scoreValue)
    if (!val || val < 1)  return setScoreErr('Enter a valid score.')
    const cat = categories.find(c => c.id === scoreCategoryId)
    if (cat && val > cat.maxScore) return setScoreErr(`Max score for ${cat.name} is ${cat.maxScore}.`)
    setScoreSaving(true); setScoreErr(''); setScoreSuccess('')
    try {
      const check = await api.get(`/scores/member/${scoreMemberId}/check`, {
        params: { categoryId: scoreCategoryId, date: scoreDate }
      })
      if (check.data.exists) {
        setScoreErr(`A score for this category already exists on ${scoreDate}.`)
        setScoreSaving(false); return
      }
      await api.post('/scores', {
        memberId: scoreMemberId,
        categoryId: scoreCategoryId,
        scoreValue: val,
        date: new Date(scoreDate).toISOString(),
        description: scoreDesc || undefined,
      })
      const memberName = cls?.members.find(m => m.memberId === scoreMemberId)?.fullName ?? ''
      setScoreSuccess(`Score recorded for ${memberName}.`)
      setScoreValue(''); setScoreDesc('')
      loadLeaderboard(lbCategory || undefined)
    } catch {
      setScoreErr('Failed to save score.')
    }
    setScoreSaving(false)
  }

  if (loading) return <div className="container"><p>{t('common.loading')}</p></div>
  if (!cls)    return <div className="container"><p>Class not found.</p></div>

  const currentUserId = auth.user?.id
  const isServant = auth.hasRole('Servant')
  const isAssigned = cls.servants.some(s => s.userId === currentUserId)
  if (isServant && !isAssigned) {
    return (
      <div>
        <Header />
        <div className="container">
          <p style={{ color: 'red' }}>You do not have access to this class.</p>
          <Link to="/classes">← {t('nav.classes')}</Link>
        </div>
      </div>
    )
  }

  const assignedUserIds = new Set(cls.servants.map(s => s.userId))
  const availableUsers  = users.filter(u => !assignedUserIds.has(u.id))

  return (
    <div>
      <Header />
      <div className="container">
        {/* Breadcrumb */}
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 4 }}>
          <Link to="/groups" style={{ color: '#4f46e5' }}>{t('classDetail.breadcrumb')}</Link>
          {cls.groupName && <> / {cls.groupName}</>}
        </p>

        <div className="page-header">
          <div>
            <h2 style={{ margin: 0 }}>{cls.className}</h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
              {cls.ageGroup && <span>{t('classes.ageGroup')}: {cls.ageGroup}</span>}
              {(cls.minAge != null || cls.maxAge != null) && (
                <span style={{ marginLeft: cls.ageGroup ? 12 : 0 }}>
                  Ages {cls.minAge ?? '?'}–{cls.maxAge ?? '?'}
                  {cls.gender && <span style={{ marginLeft: 4, color: '#6366f1', fontWeight: 600 }}>· {cls.gender}</span>}
                  <span style={{ color: '#94a3b8', marginLeft: 4 }}>(as of Sep 15)</span>
                </span>
              )}
            </p>
          </div>
          {canAutoEnroll && (cls.minAge != null || cls.maxAge != null) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <button className="btn-primary" onClick={autoEnroll} disabled={autoEnrolling}
                style={{ background: '#0891b2' }}>
                {autoEnrolling ? 'Enrolling…' : '⚡ Auto-Enroll by Age'}
              </button>
              {autoEnrollMsg && (
                <span style={{ fontSize: 13, color: '#0369a1' }}>{autoEnrollMsg}</span>
              )}
            </div>
          )}
        </div>

        {/* ── Servants ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>{t('classDetail.servants')} ({cls.servants.length})</h3>

          <table className="table" style={{ marginBottom: 10 }}>
            <thead><tr><th>{t('common.name')}</th>{canManage && <th></th>}</tr></thead>
            <tbody>
              {cls.servants.length === 0 && (
                <tr><td colSpan={2} style={{ color: '#aaa', fontStyle: 'italic' }}>{t('classDetail.noServants')}</td></tr>
              )}
              {cls.servants.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  {canManage && <td style={{ textAlign: 'right' }}>
                    <button className="btn-sm btn-danger" onClick={() => removeServant(s.id)}>{t('common.delete')}</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>

          {canManage && (
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={addServantId} onChange={e => setAddServantId(e.target.value)} style={{ flex: 1 }}>
                <option value="">{t('classDetail.selectUser')}</option>
                {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button className="btn-sm btn-primary" onClick={addServant} disabled={servantSaving}>{t('classDetail.addServant')}</button>
            </div>
          )}
          {servantErr && <div className="error" style={{ marginTop: 6 }}>{servantErr}</div>}
        </div>

        {/* ── Members ── */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('classDetail.members')} ({cls.members.length})</h3>

          <table className="table" style={{ marginBottom: 10 }}>
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('family.gender')}</th>
                <th>{t('family.relation')}</th>
                <th>Year</th>
                {canEnroll && <th></th>}
              </tr>
            </thead>
            <tbody>
              {cls.members.length === 0 && (
                <tr><td colSpan={5} style={{ color: '#aaa', fontStyle: 'italic' }}>{t('classDetail.noMembers')}</td></tr>
              )}
              {cls.members.map(m => (
                <tr key={m.id}>
                  <td>{m.fullName}</td>
                  <td>{m.gender ?? '—'}</td>
                  <td>{m.relation ?? '—'}</td>
                  <td>{m.academicYear}</td>
                  {canEnroll && <td style={{ textAlign: 'right' }}>
                    <button className="btn-sm btn-danger" onClick={() => removeMember(m.id)}>{t('common.delete')}</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>

          {canEnroll && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={memberSearch}
                onChange={e => { setMemberSearch(e.target.value); setAddMemberId('') }}
                placeholder="Search member by name…"
                style={{ flex: 1, minWidth: 200 }}
              />
              {memberOptions.length > 0 && (
                <select value={addMemberId} onChange={e => setAddMemberId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">{t('classDetail.selectMember')}</option>
                  {memberOptions.map(m => <option key={m.id} value={m.id}>{m.fullName}{m.familyName ? ` — ${m.familyName}` : ''}</option>)}
                </select>
              )}
              <button className="btn-sm btn-primary" onClick={enrollMember} disabled={memberSaving || !addMemberId}>{t('classDetail.enroll')}</button>
            </div>
          )}
          {memberErr && <div className="error" style={{ marginTop: 6 }}>{memberErr}</div>}
        </div>

        {/* ── Scores ── */}
        {canScore && (
          <div className="card" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>{t('scores.title')}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn-sm${scoreTab === 'leaderboard' ? ' btn-primary' : ''}`}
                  onClick={() => setScoreTab('leaderboard')}
                >{t('scores.leaderboard')}</button>
                <button
                  className={`btn-sm${scoreTab === 'add' ? ' btn-primary' : ''}`}
                  onClick={() => setScoreTab('add')}
                >{t('scores.addScore')}</button>
              </div>
            </div>

            {scoreTab === 'leaderboard' && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <select
                    value={lbCategory}
                    onChange={e => setLbCategory(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                  >
                    <option value="">{t('scores.allCategories')}</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {lbLoading ? (
                  <p style={{ color: '#888' }}>{t('common.loading')}</p>
                ) : leaderboard.length === 0 ? (
                  <p style={{ color: '#888', fontStyle: 'italic' }}>{t('scores.noScores')}</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>{t('scores.rank')}</th>
                        <th>{t('scores.member').replace(' *', '')}</th>
                        <th style={{ width: 100, textAlign: 'right' }}>{t('scores.total')}</th>
                        <th style={{ width: 80, textAlign: 'right' }}>{t('scores.entries')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map(row => (
                        <tr key={row.memberId}>
                          <td>
                            <span style={{
                              fontWeight: 700,
                              color: row.rank === 1 ? '#f59e0b' : row.rank === 2 ? '#94a3b8' : row.rank === 3 ? '#b45309' : '#374151'
                            }}>
                              {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank}
                            </span>
                          </td>
                          <td>
                            <Link to={`/members/${row.memberId}`} style={{ color: '#4f46e5', fontWeight: 500 }}>
                              {row.memberName}
                            </Link>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>{row.totalScore}</td>
                          <td style={{ textAlign: 'right', color: '#64748b' }}>{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {scoreTab === 'add' && (
              <div style={{ maxWidth: 480 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('scores.member')}</label>
                    <select value={scoreMemberId} onChange={e => setScoreMemberId(e.target.value)} style={{ width: '100%' }}>
                      <option value="">{t('scores.selectMember')}</option>
                      {cls?.members.map(m => <option key={m.memberId} value={m.memberId}>{m.fullName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('scores.category')}</label>
                    <select value={scoreCategoryId} onChange={e => setScoreCategoryId(e.target.value)} style={{ width: '100%' }}>
                      <option value="">{t('scores.selectCategory')}</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name} (max {c.maxScore})</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('scores.score')}</label>
                      <input
                        type="number" min="1"
                        max={categories.find(c => c.id === scoreCategoryId)?.maxScore ?? 100}
                        value={scoreValue}
                        onChange={e => setScoreValue(e.target.value)}
                        placeholder={`1 – ${categories.find(c => c.id === scoreCategoryId)?.maxScore ?? 100}`}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Date *</label>
                      <input type="date" value={scoreDate} onChange={e => setScoreDate(e.target.value)} style={{ width: '100%' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('scores.note')}</label>
                    <input value={scoreDesc} onChange={e => setScoreDesc(e.target.value)} placeholder="e.g. Great attendance" style={{ width: '100%' }} />
                  </div>
                </div>
                {scoreErr     && <div className="error" style={{ marginTop: 10 }}>{scoreErr}</div>}
                {scoreSuccess && <div style={{ marginTop: 10, color: '#16a34a', fontWeight: 600 }}>{scoreSuccess}</div>}
                <div style={{ marginTop: 14 }}>
                  <button className="btn-primary" onClick={submitScore} disabled={scoreSaving}>
                    {scoreSaving ? t('common.saving') : t('scores.recordScore')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
