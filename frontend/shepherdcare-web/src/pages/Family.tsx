import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import Header from '../components/Header'
import MemberFormModal from '../components/MemberFormModal'
import PriestNoteCreateForm from '../components/PriestNoteCreateForm'
import { useAuth } from '../auth'
import { useT } from '../i18n'
import type { Family, Member, PriestNote } from '../types'
import { formatAge } from '../utils/ageDisplay'
interface FamilyLink {
  id: string
  linkedFamilyId: string
  linkedFamilyName: string
  relationLabel?: string
  direction: 'outgoing' | 'incoming'
}

interface FamilyOption { id: string; familyName: string }

interface SuggestedLink {
  matchedMemberId: string
  familyId: string
  familyName: string
  matchedMemberName: string
  matchedMemberRelation?: string
  matchedMemberGender?: string
  localMemberId?: string
  localMemberName?: string
  localMemberRelation?: string
  localMemberGender?: string
  nationalId: string
}

export default function FamilyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const auth = useAuth()
  const { t } = useT()

  const isServant = auth.hasRole('Servant')
  const canEdit = !isServant && (auth.hasRole('SuperAdmin') || auth.hasRole('DataEntry'))

  const [family, setFamily]             = useState<Family | null>(null)
  const [members, setMembers]           = useState<Member[]>([])
  const [notes, setNotes]               = useState<PriestNote[]>([])
  const [showAddMember, setShowAddMember]   = useState(false)
  const [editMember, setEditMember]         = useState<Member | null>(null)
  const [deleteMember, setDeleteMember]     = useState<Member | null>(null)
  const [deleteScope, setDeleteScope]       = useState<'family' | 'all'>('family')
  const [deleting, setDeleting]         = useState(false)
  const [loading, setLoading]           = useState(true)
  const [showDeleteFamily, setShowDeleteFamily] = useState(false)
  const [deletingFamily, setDeletingFamily]     = useState(false)

  // Related families
  const [links, setLinks]               = useState<FamilyLink[]>([])
  const [suggestedLinks, setSuggestedLinks] = useState<SuggestedLink[]>([])
  const [creatingFamilyFor, setCreatingFamilyFor] = useState<SuggestedLink | null>(null)
  const [familySearch, setFamilySearch] = useState('')
  const [familyOptions, setFamilyOptions] = useState<FamilyOption[]>([])
  const [linkTarget, setLinkTarget]     = useState('')
  const [linkLabel, setLinkLabel]       = useState('')
  const [linkErr, setLinkErr]           = useState('')
  const [linkSaving, setLinkSaving]     = useState(false)
  const [editLinkId, setEditLinkId]     = useState<string | null>(null)
  const [editLinkLabel, setEditLinkLabel] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<Family>(`/families/${id}`),
      api.get<PriestNote[]>(`/priestnotes/by-family/${id}`).catch(() => ({ data: [] as PriestNote[] })),
      api.get<FamilyLink[]>(`/families/${id}/links`).catch(() => ({ data: [] as FamilyLink[] })),
      api.get<SuggestedLink[]>(`/members/suggest-links/${id}`).catch(() => ({ data: [] as SuggestedLink[] })),
    ]).then(([fRes, nRes, lRes, sRes]) => {
      setFamily(fRes.data)
      setMembers(fRes.data.members || [])
      setNotes(nRes.data)
      setLinks(lRes.data)
      setSuggestedLinks(sRes.data)
    }).finally(() => setLoading(false))
  }, [id])

  const handleMemberSaved = (m: Member) => {
    setMembers(prev => prev.some(x => x.id === m.id) ? prev.map(x => x.id === m.id ? m : x) : [m, ...prev])
    setShowAddMember(false)
    setEditMember(null)
  }

  const confirmDeleteMember = async () => {
    if (!deleteMember) return
    setDeleting(true)
    try {
      await api.delete(`/members/${deleteMember.id}`, { params: { scope: deleteScope } })
      if (deleteScope === 'all') {
        setMembers(prev => prev.filter(x => !deleteMember.nationalId || x.nationalId !== deleteMember.nationalId))
      } else {
        setMembers(prev => prev.filter(x => x.id !== deleteMember.id))
      }
      setDeleteMember(null)
    } catch {
      alert('Failed to delete member.')
    } finally {
      setDeleting(false)
    }
  }

  const confirmDeleteFamily = async () => {
    if (!family) return
    setDeletingFamily(true)
    try {
      await api.delete(`/families/${id}`)
      navigate('/families')
    } catch {
      alert('Failed to delete family.')
      setDeletingFamily(false)
    }
  }

  useEffect(() => {
    if (familySearch.length < 2) { setFamilyOptions([]); return }
    api.get<{ items: FamilyOption[] }>('/families', { params: { q: familySearch, pageSize: 10 } })
      .then(r => setFamilyOptions((r.data.items ?? []).filter(f => f.id !== id)))
      .catch(() => setFamilyOptions([]))
  }, [familySearch])

  const addLink = async () => {
    if (!linkTarget) return setLinkErr('Select a family to link.')
    setLinkSaving(true); setLinkErr('')
    try {
      const r = await api.post<FamilyLink>(`/families/${id}/links`, { linkedFamilyId: linkTarget, relationLabel: linkLabel || undefined })
      setLinks(prev => [...prev, r.data])
      setLinkTarget(''); setLinkLabel(''); setFamilySearch(''); setFamilyOptions([])
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      setLinkErr(status === 409 ? t('family.alreadyLinked') : t('family.linkFailed'))
    }
    setLinkSaving(false)
  }

  const removeLink = async (linkId: string) => {
    await api.delete(`/families/${id}/links/${linkId}`)
    setLinks(prev => prev.filter(l => l.id !== linkId))
  }

  const saveEditLabel = async (linkId: string) => {
    await api.patch(`/families/${id}/links/${linkId}`, { linkedFamilyId: '00000000-0000-0000-0000-000000000000', relationLabel: editLinkLabel })
    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, relationLabel: editLinkLabel } : l))
    setEditLinkId(null)
  }

  const siblingLabel = (gender?: string) =>
    (gender ?? '').toLowerCase() === 'female' ? "Sister's family" : "Brother's family"

  const acceptSuggestion = async (suggestion: SuggestedLink) => {
    const isFather = ['father', 'head'].includes((suggestion.matchedMemberRelation ?? '').toLowerCase())

    if (isFather) {
      setCreatingFamilyFor(suggestion)
      return
    }

    const fwdLabel = siblingLabel(suggestion.matchedMemberGender)
    const revLabel = siblingLabel(suggestion.localMemberGender)

    try {
      const r = await api.post<FamilyLink>(`/families/${id}/links`, {
        linkedFamilyId: suggestion.familyId,
        relationLabel:  fwdLabel,
        reverseLabel:   revLabel,
      })
      setLinks(prev => [...prev, r.data])
      setSuggestedLinks(prev => prev.filter(s => s.familyId !== suggestion.familyId))
    } catch {
      setSuggestedLinks(prev => prev.filter(s => s.familyId !== suggestion.familyId))
    }
  }

  const createFatherFamily = async (suggestion: SuggestedLink) => {
    try {
      const childLabel = siblingLabel(suggestion.localMemberGender)
      const siblingLabel1 = siblingLabel(suggestion.localMemberGender)
      const siblingLabel2 = siblingLabel(suggestion.matchedMemberGender)

      await api.post<{ id: string; familyName: string; alreadyExisted: boolean }>(
        `/families/from-member/${suggestion.matchedMemberId}`,
        {
          originFamilyId: id,
          originLabel:    childLabel,
          newFamilyLabel: "Father's family",
        }
      )

      await api.post(`/families/${id}/links`, {
        linkedFamilyId: suggestion.familyId,
        relationLabel:  siblingLabel2,
        reverseLabel:   siblingLabel1,
      })

      const [linksRes, suggestRes] = await Promise.all([
        api.get<FamilyLink[]>(`/families/${id}/links`),
        api.get<SuggestedLink[]>(`/members/suggest-links/${id}`)
      ])
      setLinks(linksRes.data)
      setSuggestedLinks(suggestRes.data)
    } catch (err) {
      console.error('Error creating father family:', err)
    } finally {
      setCreatingFamilyFor(null)
    }
  }

  const age = (dob?: string) => formatAge(dob)

  if (loading) return <div className="container"><p>{t('common.loading')}</p></div>
  if (!family)  return <div className="container"><p>Family not found.</p></div>

  return (
    <div>
      <Header />
      <div className="container">

        {/* Breadcrumb */}
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 4 }}>
          <Link to="/families" style={{ color: '#4f46e5' }}>{t('family.breadcrumb')}</Link>
        </p>

        {/* Family header */}
        <div className="page-header">
          <div>
            <h2 style={{ margin: 0 }}>
              {family.familyName}
              {isServant && <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal', marginLeft: '12px' }}>{t('common.readOnly')}</span>}
            </h2>
            {family.address && <p style={{ margin: '4px 0 0', color: '#64748b' }}>{family.address}</p>}
          </div>
          {!isServant && (
            <button className="btn-danger" onClick={() => setShowDeleteFamily(true)}>
              {t('family.deleteFamily')}
            </button>
          )}
        </div>

        {/* Family meta */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
          {family.area        && <span className="badge">📍 {family.area}</span>}
          {!isServant && family.phoneNumbers && <span className="badge">📞 {family.phoneNumbers}</span>}
          {family.status      && <span className="badge">Status: {family.status}</span>}
        </div>

        {/* ── Members ───────────────────────────────────────── */}
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{t('family.members')} ({members.length})</h3>
          {canEdit && <button className="btn-primary" onClick={() => setShowAddMember(true)}>{t('family.addMember')}</button>}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('family.relation')}</th>
              <th>{t('family.gender')}</th>
              <th>{t('family.age')}</th>
              <th>{t('family.mobile')}</th>
              <th>{t('family.nationalId')}</th>
              <th>{t('family.child')}</th>
              {canEdit && <th>{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr><td colSpan={canEdit ? 8 : 7} style={{ textAlign: 'center', color: '#888' }}>{t('family.noMembers')}{canEdit && t('family.addOneAbove')}.</td></tr>
            )}
            {members.map(m => (
              <tr key={m.id}>
                <td>
                  <Link to={`/members/${m.primaryMemberId ?? m.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: '#f1f5f9', border: '1px solid #e5e7eb',
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
                    }}>
                      {m.photoUrl
                        ? <img src={m.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (m.gender === 'Female' ? '👩' : '👤')}
                    </div>
                    <strong style={{ color: '#1d4ed8' }}>{m.fullName}</strong>
                  </Link>
                  {m.notes && <div style={{ fontSize: '0.78rem', color: '#888' }}>{m.notes}</div>}
                </td>
                <td>{m.relation ?? '—'}</td>
                <td>{m.gender ?? '—'}</td>
                <td>{age(m.dateOfBirth)}</td>
                <td>
                  {m.mobile
                    ? m.mobile
                    : (isServant
                        ? <span style={{ color: '#999', fontSize: '0.85rem' }}>{t('common.hidden')}</span>
                        : '—'
                      )
                  }
                </td>
                <td style={{ fontFamily: 'monospace', letterSpacing: '0.05em', fontSize: '0.85rem' }}>
                  {m.nationalId ?? '—'}
                </td>
                <td style={{ textAlign: 'center' }}>{m.isChild ? '✓' : ''}</td>
                {canEdit && (
                  <td>
                    <button className="btn-sm" onClick={() => setEditMember(m)}>{t('common.edit')}</button>
                    {' '}
                    <button className="btn-sm btn-danger" onClick={() => { setDeleteMember(m); setDeleteScope('family') }}>{t('common.delete')}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Suggested Family Links ─── */}
        {canEdit && suggestedLinks.length > 0 && (
          <div className="card" style={{ marginTop: 32, border: '1px solid #fbbf24', background: '#fffbeb', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: '1.1rem' }}>🔗</span>
              <h3 style={{ margin: 0, color: '#92400e' }}>{t('family.suggestedLinks')} ({suggestedLinks.length})</h3>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#78350f' }}>
              {t('family.suggestedLinksDesc')}
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Family</th>
                  <th>{t('family.matchedVia')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {suggestedLinks.map(s => (
                  <tr key={s.familyId}>
                    <td>
                      <Link to={`/families/${s.familyId}`} style={{ color: '#4f46e5', fontWeight: 500 }}>
                        {s.familyName}
                      </Link>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#374151' }}>
                      <span style={{ fontFamily: 'monospace' }}>{s.nationalId}</span>
                      {' — '}
                      <strong>{s.localMemberName}</strong>
                      {s.localMemberRelation && ` (${s.localMemberRelation})`}
                      {' ↔ '}
                      <strong>{s.matchedMemberName}</strong>
                      {s.matchedMemberRelation && ` (${s.matchedMemberRelation})`}
                      {' in '}{s.familyName}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn-sm btn-primary" onClick={() => acceptSuggestion(s)}>
                        {t('family.linkFamilies')}
                      </button>
                      {' '}
                      <button className="btn-sm" onClick={() => setSuggestedLinks(prev => prev.filter(x => x.familyId !== s.familyId))}>
                        {t('family.dismiss')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Related Families ───────────────────────────────────── */}
        {!isServant && (
          <>
            <h3 style={{ marginTop: 32 }}>{t('family.relatedFamilies')} ({links.length})</h3>

            {links.length > 0 && (
          <table className="table" style={{ marginBottom: 12 }}>
            <thead>
              <tr><th>Family</th><th>Relationship</th><th></th></tr>
            </thead>
            <tbody>
              {links.map(l => (
                <tr key={l.id}>
                  <td>
                    <Link to={`/families/${l.linkedFamilyId}`} style={{ color: '#4f46e5', fontWeight: 500 }}>
                      {l.linkedFamilyName}
                    </Link>
                    {l.direction === 'incoming' && (
                      <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#94a3b8' }}>{t('family.linkedFromThem')}</span>
                    )}
                  </td>
                  <td>
                    {editLinkId === l.id && l.direction === 'outgoing' ? (
                      <input
                        value={editLinkLabel}
                        onChange={e => setEditLinkLabel(e.target.value)}
                        placeholder="e.g. Son's family"
                        style={{ width: 200 }}
                      />
                    ) : (
                      <span style={{ color: l.relationLabel ? '#1e293b' : '#94a3b8', fontStyle: l.relationLabel ? 'normal' : 'italic' }}>
                        {l.relationLabel || (l.direction === 'outgoing' ? t('family.noLabel') : '—')}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {l.direction === 'outgoing' && (
                      editLinkId === l.id ? (
                        <>
                          <button className="btn-sm btn-primary" onClick={() => saveEditLabel(l.id)}>{t('common.save')}</button>
                          {' '}
                          <button className="btn-sm" onClick={() => setEditLinkId(null)}>{t('common.cancel')}</button>
                        </>
                      ) : (
                        <button className="btn-sm" onClick={() => { setEditLinkId(l.id); setEditLinkLabel(l.relationLabel ?? '') }}>{t('family.editLabel')}</button>
                      )
                    )}
                    {' '}
                    <button className="btn-sm btn-danger" onClick={() => removeLink(l.id)}>{t('family.unlink')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Link a family */}
        <div className="card" style={{ padding: 14 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 500, fontSize: '0.9rem' }}>{t('family.linkAnother')}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={familySearch}
              onChange={e => { setFamilySearch(e.target.value); setLinkTarget('') }}
              placeholder={t('family.searchFamily')}
              style={{ flex: 1, minWidth: 180 }}
            />
            {familyOptions.length > 0 && (
              <select value={linkTarget} onChange={e => setLinkTarget(e.target.value)} style={{ flex: 1 }}>
                <option value="">{t('family.selectFamily')}</option>
                {familyOptions.map(f => <option key={f.id} value={f.id}>{f.familyName}</option>)}
              </select>
            )}
            <input
              value={linkLabel}
              onChange={e => setLinkLabel(e.target.value)}
              placeholder={t('family.relationLabel')}
              style={{ flex: 2, minWidth: 200 }}
            />
            <button className="btn-primary btn-sm" onClick={addLink} disabled={linkSaving || !linkTarget}>
              {t('family.addLink')}
            </button>
          </div>
          {linkErr && <div className="error" style={{ marginTop: 6 }}>{linkErr}</div>}
        </div>
          </>
        )}

        {/* ── Priest Notes ───────────────────────────────────── */}
        {!isServant && (
          <>
            <h3 style={{ marginTop: 32 }}>{t('family.priestNotes')}</h3>
            <PriestNoteCreateForm familyId={id} onCreated={(n: PriestNote) => setNotes(prev => [n, ...prev])} />
            <div style={{ marginTop: 12 }}>
              {notes.length === 0 && <p style={{ color: '#888' }}>{t('family.noNotes')}</p>}
              {notes.map(n => (
                <div key={n.id} style={{ padding: '10px 14px', background: '#fff', borderRadius: 8,
                                          border: '1px solid #e5e7eb', marginBottom: 8 }}>
                  <div>{n.content}</div>
                  {n.createdAt && (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Add member modal */}
        {canEdit && showAddMember && (
          <MemberFormModal
            familyId={id!}
            member={null}
            onSaved={handleMemberSaved}
            onCancel={() => setShowAddMember(false)}
          />
        )}

        {/* Edit member modal */}
        {canEdit && editMember && (
          <MemberFormModal
            familyId={id!}
            member={editMember}
            onSaved={handleMemberSaved}
            onCancel={() => setEditMember(null)}
          />
        )}

        {/* Delete member — choose scope */}
        {canEdit && deleteMember && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{t('family.removeMember')}</h3>
              <p style={{ marginBottom: 16 }}>
                {t('family.howRemove', { name: deleteMember.fullName })}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
                                padding: '10px 14px', border: `2px solid ${deleteScope === 'family' ? '#4f46e5' : '#e5e7eb'}`,
                                borderRadius: 8, background: deleteScope === 'family' ? '#eef2ff' : '#fff' }}>
                  <input type="radio" checked={deleteScope === 'family'} onChange={() => setDeleteScope('family')} style={{ width: 'auto', margin: '2px 0 0' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{t('family.removeFromFamilyOnly')}</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
                      {t('family.removeFromFamilyDesc', { familyName: family?.familyName ?? '' })}
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
                                padding: '10px 14px', border: `2px solid ${deleteScope === 'all' ? '#dc2626' : '#e5e7eb'}`,
                                borderRadius: 8, background: deleteScope === 'all' ? '#fef2f2' : '#fff' }}>
                  <input type="radio" checked={deleteScope === 'all'} onChange={() => setDeleteScope('all')} style={{ width: 'auto', margin: '2px 0 0' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#dc2626' }}>{t('family.deleteEverywhere')}</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
                      {t('family.deleteEverywhereDesc', { name: deleteMember.fullName })}
                    </div>
                  </div>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  className={deleteScope === 'all' ? 'btn-danger' : 'btn-primary'}
                  onClick={confirmDeleteMember}
                  disabled={deleting}
                >
                  {deleting ? t('family.removing') : deleteScope === 'all' ? t('family.deleteEverywhereBtn') : t('family.removeBtn')}
                </button>
                <button onClick={() => setDeleteMember(null)} disabled={deleting}>{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Create Father's Family modal */}
        {canEdit && creatingFamilyFor && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{t('family.createFatherFamily')}</h3>
              <p>
                {t('family.createFatherDesc', { name: creatingFamilyFor.matchedMemberName, relation: creatingFamilyFor.matchedMemberRelation ?? '', family: creatingFamilyFor.familyName })}
              </p>
              <p style={{ marginTop: 0, color: '#374151', fontSize: '0.9rem' }}>
                {t('family.createFatherQuestion', { name: creatingFamilyFor.matchedMemberName })}
              </p>
              <div className="modal-actions">
                <button className="btn-primary" onClick={() => createFatherFamily(creatingFamilyFor)}>
                  {t('family.createFatherYes')}
                </button>
                <button onClick={() => setCreatingFamilyFor(null)}>{t('family.createFatherNo')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete family confirmation */}
        {canEdit && showDeleteFamily && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{t('family.deleteFamilyTitle')}</h3>
              <p>
                {t('family.deleteFamilyConfirm', { name: family.familyName })}
              </p>
              <p style={{ color: '#dc2626', fontSize: '0.88rem', marginTop: 0 }}>
                ⚠️ {t('common.undonable')}
              </p>
              <div className="modal-actions">
                <button className="btn-danger" onClick={confirmDeleteFamily} disabled={deletingFamily}>
                  {deletingFamily ? t('family.deleting') : t('family.deleteFamilyBtn')}
                </button>
                <button onClick={() => setShowDeleteFamily(false)} disabled={deletingFamily}>{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
