import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import Header from '../components/Header'
import Pagination from '../components/Pagination'
import { useAuth } from '../auth'
import { useT } from '../i18n'

interface ScoreCategory { id: string; name: string; maxScore: number }
interface MemberOption  { id: string; fullName: string }
interface ScoreRow {
  id: string
  memberId: string
  memberName?: string
  categoryId: string
  categoryName?: string
  scoreValue: number
  date: string
  description?: string
  createdAt: string
  recordedByName?: string
}
interface PagedResult { items: ScoreRow[]; page: number; pageSize: number; totalCount: number }
interface MemberSummary {
  memberId: string
  memberName: string
  totalScore: number
  count: number
  averageScore: number
  byCategory: { categoryId: string; categoryName: string; totalScore: number; count: number; averageScore: number }[]
}
interface ClassOption { id: string; className: string }
interface PendingScoreRow {
  id: string
  memberId: string
  memberName?: string
  categoryId: string
  categoryName?: string
  date: string
  note?: string
  status: string
  submittedAt: string
  submittedByName?: string
}

export default function ScoresPage() {
  const auth = useAuth()
  const { t } = useT()
  const isAdmin    = auth.hasRole('SuperAdmin') || auth.hasRole('ServiceLeader')
  const isServant  = auth.hasRole('Servant') || auth.hasRole('DataEntry')
  const canEdit    = isAdmin || isServant
  const canDelete  = isAdmin || isServant

  const [categories, setCategories]       = useState<ScoreCategory[]>([])
  const [scores, setScores]               = useState<ScoreRow[]>([])
  const [page, setPage]                   = useState(1)
  const [totalPages, setTotalPages]       = useState(1)
  const [totalCount, setTotalCount]       = useState(0)
  const [loading, setLoading]             = useState(false)

  // Servant class picker
  const [myClasses, setMyClasses]         = useState<ClassOption[]>([])
  const [selectedClass, setSelectedClass] = useState('')

  // Filters
  const [memberSearch, setMemberSearch]   = useState('')
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [memberId, setMemberId]           = useState('')
  const [memberName, setMemberName]       = useState('')
  const [categoryId, setCategoryId]       = useState('')

  // Member summary
  const [summary, setSummary]             = useState<MemberSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Edit
  const [editTarget, setEditTarget]       = useState<ScoreRow | null>(null)
  const [editValue, setEditValue]         = useState('')
  const [editDesc, setEditDesc]           = useState('')
  const [editErr, setEditErr]             = useState('')
  const [editSaving, setEditSaving]       = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget]   = useState<ScoreRow | null>(null)
  const [deleting, setDeleting]           = useState(false)

  // Tab & pending
  const [activeTab, setActiveTab]         = useState<'scores' | 'pending'>('scores')
  const [pending, setPending]             = useState<PendingScoreRow[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [reviewing, setReviewing]         = useState<string | null>(null)

  useEffect(() => {
    api.get<ScoreCategory[]>('/score-categories').then(r => setCategories(r.data))

    // For servants, load their classes so they can filter
    if (isServant && !isAdmin) {
      api.get<{ items: ClassOption[] }>('/classes', { params: { pageSize: 100 } })
        .then(r => {
          setMyClasses(r.data.items ?? [])
          if ((r.data.items ?? []).length === 1) setSelectedClass(r.data.items[0].id)
        })
        .catch(() => {})
    }
  }, [])

  // Member search (admin only — servants see their class members from the leaderboard)
  useEffect(() => {
    if (!isAdmin) return
    if (memberSearch.length < 2) { setMemberOptions([]); return }
    api.get<{ items: MemberOption[] }>('/members/search', { params: { q: memberSearch, pageSize: 20 } })
      .then(r => setMemberOptions(r.data.items ?? []))
      .catch(() => setMemberOptions([]))
  }, [memberSearch, isAdmin])

  const load = useCallback(() => {
    setLoading(true)
    const params: Record<string, string | number> = { page, pageSize: 20 }
    if (memberId)    params.memberId    = memberId
    if (categoryId)  params.categoryId  = categoryId
    api.get<PagedResult>('/scores', { params })
      .then(r => {
        setScores(r.data.items)
        setTotalCount(r.data.totalCount)
        setTotalPages(Math.max(1, Math.ceil(r.data.totalCount / 20)))
      })
      .catch(() => { setScores([]); setTotalPages(1) })
      .finally(() => setLoading(false))
  }, [page, memberId, categoryId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!memberId) { setSummary(null); return }
    setSummaryLoading(true)
    api.get<MemberSummary>(`/scores/member/${memberId}/summary`)
      .then(r => setSummary(r.data))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false))
  }, [memberId])

  const selectMember = (id: string, name: string) => {
    setMemberId(id); setMemberName(name)
    setMemberSearch(''); setMemberOptions([])
    setPage(1)
  }

  const clearMember = () => {
    setMemberId(''); setMemberName('')
    setSummary(null); setPage(1)
  }

  const openEdit = (s: ScoreRow) => {
    setEditTarget(s)
    setEditValue(String(s.scoreValue))
    setEditDesc(s.description ?? '')
    setEditErr('')
  }

  const saveEdit = async () => {
    if (!editTarget) return
    const val = parseInt(editValue)
    if (!val || val < 1) return setEditErr('Enter a valid score.')
    setEditSaving(true); setEditErr('')
    try {
      await api.put(`/scores/${editTarget.id}`, { scoreValue: val, description: editDesc || undefined })
      setScores(prev => prev.map(s => s.id === editTarget.id ? { ...s, scoreValue: val, description: editDesc || s.description } : s))
      if (memberId) api.get<MemberSummary>(`/scores/member/${memberId}/summary`).then(r => setSummary(r.data))
      setEditTarget(null)
    } catch { setEditErr('Failed to save.') }
    setEditSaving(false)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/scores/${deleteTarget.id}`)
      setScores(prev => prev.filter(s => s.id !== deleteTarget.id))
      setTotalCount(p => p - 1)
      setDeleteTarget(null)
      if (memberId)
        api.get<MemberSummary>(`/scores/member/${memberId}/summary`).then(r => setSummary(r.data))
    } catch { alert('Failed to delete score.') }
    setDeleting(false)
  }

  const loadPending = () => {
    setPendingLoading(true)
    api.get<PendingScoreRow[]>('/scores/pending')
      .then(r => setPending(r.data))
      .catch(() => setPending([]))
      .finally(() => setPendingLoading(false))
  }

  const reviewScore = async (id: string, action: 'approve' | 'reject') => {
    setReviewing(id)
    try {
      await api.post(`/scores/pending/${id}/${action}`, {})
      setPending(prev => prev.filter(p => p.id !== id))
      if (action === 'approve') load()
    } catch { alert('فشلت العملية.') }
    setReviewing(null)
  }

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <h2>{t('scores.title')}</h2>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{totalCount} {t('scores.entries')}</span>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────── */}
        {(isAdmin || isServant) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              className={`btn-sm${activeTab === 'scores' ? ' btn-primary' : ''}`}
              onClick={() => setActiveTab('scores')}
            >
              {t('scores.title')}
            </button>
            <button
              className={`btn-sm${activeTab === 'pending' ? ' btn-primary' : ''}`}
              onClick={() => { setActiveTab('pending'); loadPending() }}
            >
              طلبات الأعضاء
              {pending.length > 0 && (
                <span style={{ marginRight: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: '0.75rem', fontWeight: 700 }}>
                  {pending.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* ── Pending scores tab ──────────────────────────────────── */}
        {activeTab === 'pending' && (
          <div>
            {pendingLoading ? (
              <p style={{ color: '#888' }}>{t('common.loading')}</p>
            ) : pending.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', color: '#888', padding: '32px' }}>
                لا توجد طلبات معلقة
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('reports.member')}</th>
                    <th>{t('scores.category')}</th>
                    <th>{t('visits.date')}</th>
                    <th>ملاحظة</th>
                    <th>وقت الإرسال</th>
                    <th style={{ width: 160 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.memberName ?? '—'}</td>
                      <td>
                        <span style={{ background: '#ede9fe', color: '#4f46e5', borderRadius: 12, padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600 }}>
                          {p.categoryName ?? '—'}
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        {new Date(p.date).toLocaleDateString('ar-EG')}
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{p.note || '—'}</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                        {new Date(p.submittedAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn-sm btn-primary"
                            onClick={() => reviewScore(p.id, 'approve')}
                            disabled={reviewing === p.id}
                            style={{ background: '#16a34a' }}
                          >
                            ✓ قبول
                          </button>
                          <button
                            className="btn-sm btn-danger"
                            onClick={() => reviewScore(p.id, 'reject')}
                            disabled={reviewing === p.id}
                          >
                            ✕ رفض
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'scores' && <>
        {/* ── Servant: class picker ──────────────────────────────── */}
        {isServant && !isAdmin && myClasses.length > 1 && (
          <div className="card" style={{ marginBottom: 12, padding: '12px 16px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginRight: 10 }}>{t('classes.form.group')}:</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">All my classes</option>
              {myClasses.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
            </select>
          </div>
        )}

        {/* ── Filters ────────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>

            {/* Member filter — admin only (servants are already scoped by backend) */}
            {isAdmin && (
              <div style={{ flex: '1 1 220px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('scores.member')}</label>
                {memberId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, color: '#4f46e5' }}>{memberName}</span>
                    <button className="btn-sm" onClick={clearMember} style={{ padding: '2px 8px' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Search member…"
                      style={{ width: '100%' }}
                    />
                    {memberOptions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,.1)', maxHeight: 200, overflowY: 'auto'
                      }}>
                        {memberOptions.map(m => (
                          <div
                            key={m.id}
                            onClick={() => selectMember(m.id, m.fullName)}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.88rem' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                          >
                            {m.fullName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Category filter */}
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('scores.category')}</label>
              <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1) }} style={{ width: '100%' }}>
                <option value="">{t('scores.allCategories')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <button className="btn-sm" onClick={() => { setCategoryId(''); clearMember(); setPage(1) }}>
              {t('scores.clearFilters')}
            </button>
          </div>
        </div>

        {/* ── Member summary ─────────────────────────────────────── */}
        {memberId && (
          <div className="card" style={{ marginBottom: 16, background: '#f8fafc' }}>
            {summaryLoading ? (
              <p style={{ margin: 0, color: '#888' }}>{t('scores.loadingSummary')}</p>
            ) : summary ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>
                    <Link to={`/members/${summary.memberId}`} style={{ color: '#4f46e5' }}>{summary.memberName}</Link>
                    &ensp;— score summary
                  </h3>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4f46e5', lineHeight: 1 }}>{summary.totalScore}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>total pts · {summary.count} entries</div>
                  </div>
                </div>
                {summary.byCategory.length > 0 && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {summary.byCategory.map(cat => (
                      <div key={cat.categoryId} style={{
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                        padding: '8px 14px', minWidth: 100, textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 2 }}>{cat.categoryName}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#334155' }}>{cat.totalScore}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{cat.count}× · avg {cat.averageScore.toFixed(0)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ── Scores table ──────────────────────────────────────── */}
        <Pagination page={page} totalPages={totalPages} onChange={p => setPage(p)} />

        <table className="table">
          <thead>
            <tr>
              <th>{t('reports.member')}</th>
              <th>{t('scores.category')}</th>
              <th style={{ width: 80, textAlign: 'center' }}>{t('scores.score')}</th>
              <th style={{ width: 110 }}>{t('visits.date')}</th>
              <th>{t('scores.note')}</th>
              {isAdmin && <th>{t('spiritual.recordedBy')}</th>}
              {(canEdit || canDelete) && <th style={{ width: 110 }}></th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#888' }}>{t('common.loading')}</td></tr>
            )}
            {!loading && scores.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#888' }}>{t('scores.noScores')}</td></tr>
            )}
            {scores.map(s => (
              <tr key={s.id}>
                <td>
                  <Link to={`/members/${s.memberId}`} style={{ color: '#4f46e5', fontWeight: 500 }}>
                    {s.memberName ?? s.memberId}
                  </Link>
                </td>
                <td>
                  <span style={{
                    background: '#ede9fe', color: '#4f46e5',
                    borderRadius: 12, padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600
                  }}>
                    {s.categoryName ?? '—'}
                  </span>
                </td>
                <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem', color: '#334155' }}>
                  {s.scoreValue}
                </td>
                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  {new Date(s.date).toLocaleDateString('ar-EG')}
                </td>
                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  {s.description ?? '—'}
                </td>
                {isAdmin && <td style={{ color: '#64748b', fontSize: '0.82rem' }}>{s.recordedByName ?? '—'}</td>}
                {(canEdit || canDelete) && (
                  <td style={{ display: 'flex', gap: 4 }}>
                    {canEdit && <button className="btn-sm" onClick={() => openEdit(s)}>{t('common.edit')}</button>}
                    {canDelete && <button className="btn-sm btn-danger" onClick={() => setDeleteTarget(s)}>{t('common.delete')}</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <Pagination page={page} totalPages={totalPages} onChange={p => setPage(p)} />
        </>}

        {/* Edit modal */}
        {editTarget && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{t('common.edit')} — {editTarget.memberName}</h3>
              <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.85rem' }}>
                Category: <strong>{editTarget.categoryName}</strong> · Date: {new Date(editTarget.date).toLocaleDateString('ar-EG')}
              </p>
              <label>{t('scores.score')}</label>
              <input
                type="number" min="1"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                autoFocus
              />
              <label>{t('scores.note')}</label>
              <input
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="Optional note"
              />
              {editErr && <div className="error" style={{ marginTop: 8 }}>{editErr}</div>}
              <div className="modal-actions">
                <button className="btn-primary" onClick={saveEdit} disabled={editSaving}>
                  {editSaving ? t('common.saving') : t('common.save')}
                </button>
                <button onClick={() => setEditTarget(null)} disabled={editSaving}>{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{t('common.delete')}</h3>
              <p>
                Remove <strong>{deleteTarget.scoreValue} pts</strong> in <strong>{deleteTarget.categoryName}</strong> for <strong>{deleteTarget.memberName}</strong>?
              </p>
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
