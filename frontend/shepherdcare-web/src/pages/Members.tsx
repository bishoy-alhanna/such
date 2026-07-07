import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import Header from '../components/Header'
import SearchBox from '../components/SearchBox'
import Pagination from '../components/Pagination'
import MemberFormModal from '../components/MemberFormModal'
import SortTh from '../components/SortTh'
import { useSortableData } from '../hooks/useSortableData'
import { useAuth } from '../auth'
import { formatAge, formatServiceAge, sep15RefYear } from '../utils/ageDisplay'
import type { Member } from '../types'

interface MemberRow {
  id: string
  fullName: string
  familyId?: string
  familyName?: string
  gender?: string
  dateOfBirth?: string
  relation?: string
  mobile?: string
  nationalId?: string
  status?: string
  isChild: boolean
  photoUrl?: string
  isServant: boolean
}

export default function MembersPage() {
  const auth = useAuth()
  const canEdit = auth.hasRole('SuperAdmin') || auth.hasRole('DataEntry')
  const canDelete = auth.hasRole('SuperAdmin')

  const [members, setMembers]     = useState<MemberRow[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [query, setQuery]         = useState('')
  const [filter, setFilter]       = useState('')        // '' | 'withFamily' | 'withoutFamily'
  const [gender, setGender]       = useState('')
  const [loading, setLoading]     = useState(false)

  const [editMember, setEditMember]   = useState<Member | null>(null)
  const [showAdd, setShowAdd]         = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  const { sorted, sortKey, sortDir, requestSort } = useSortableData(members, 'fullName')

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get<{ items: MemberRow[]; total: number; totalPages: number }>('/members', {
        params: { q: query || undefined, filter: filter || undefined, gender: gender || undefined, page, pageSize: 25 }
      })
      setMembers(r.data.items)
      setTotal(r.data.total)
      setTotalPages(r.data.totalPages)
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [query, filter, gender, page])

  const handleSaved = (m: Member) => {
    setShowAdd(false)
    setEditMember(null)
    load()
  }

  const handleDelete = async (m: MemberRow) => {
    const hasFamily = !!m.familyId
    const msg = hasFamily
      ? `Delete "${m.fullName}" from this family only, or remove them everywhere?\n\nOK = this family only\nCancel = cancel`
      : `Delete "${m.fullName}"?`
    if (!confirm(msg)) return
    setDeletingId(m.id)
    try {
      await api.delete(`/members/${m.id}`, { params: { scope: 'family' } })
      setMembers(prev => prev.filter(x => x.id !== m.id))
      setTotal(t => t - 1)
    } catch {
      alert('Failed to delete member.')
    } finally {
      setDeletingId(null)
    }
  }

  const refYear = sep15RefYear()

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <div>
            <h2>Members</h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{total} total</div>
          </div>
          {canEdit && (
            <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Member</button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <SearchBox value={query} onChange={v => { setQuery(v); setPage(1) }} />
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }}
            style={{ minWidth: 150 }}>
            <option value="">All members</option>
            <option value="withFamily">With family</option>
            <option value="withoutFamily">Without family</option>
          </select>
          <select value={gender} onChange={e => { setGender(e.target.value); setPage(1) }}
            style={{ minWidth: 120 }}>
            <option value="">Any gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />

        {loading && <p style={{ color: '#888', padding: '8px 0' }}>Loading…</p>}

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <SortTh label="Name"        field="fullName"   current={sortKey} dir={sortDir} onSort={requestSort} />
                <SortTh label="Family"      field="familyName" current={sortKey} dir={sortDir} onSort={requestSort} />
                <SortTh label="Relation"    field="relation"   current={sortKey} dir={sortDir} onSort={requestSort} />
                <SortTh label="Gender"      field="gender"     current={sortKey} dir={sortDir} onSort={requestSort} />
                <th style={{ whiteSpace: 'nowrap' }}>
                  Age <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 400 }}>/ Sep {refYear}</span>
                </th>
                <SortTh label="Status"      field="status"     current={sortKey} dir={sortDir} onSort={requestSort} />
                <SortTh label="Mobile"      field="mobile"     current={sortKey} dir={sortDir} onSort={requestSort} />
                <SortTh label="National ID" field="nationalId" current={sortKey} dir={sortDir} onSort={requestSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No members found.</td></tr>
              )}
              {sorted.map(m => (
                <tr key={m.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: '#f1f5f9', border: '1px solid #e5e7eb',
                        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
                      }}>
                        {m.photoUrl
                          ? <img src={m.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (m.gender === 'Female' ? '👩' : '👤')}
                      </div>
                      <div>
                        <Link to={`/members/${m.id}`} style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' }}>
                          {m.fullName}
                        </Link>
                        {m.isServant && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>✝️</span>
                        )}
                        {m.isChild && (
                          <span style={{ marginLeft: 4, fontSize: 11, color: '#6b7280' }}>👶</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    {m.familyId
                      ? <Link to={`/families/${m.familyId}`} style={{ color: '#4f46e5', textDecoration: 'none' }}>{m.familyName ?? '—'}</Link>
                      : <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>No family</span>}
                  </td>
                  <td style={{ color: '#64748b' }}>{m.relation ?? '—'}</td>
                  <td style={{ color: '#64748b' }}>{m.gender ?? '—'}</td>
                  <td>
                    {m.dateOfBirth ? (
                      <div>
                        <div style={{ fontWeight: 500 }}>{formatAge(m.dateOfBirth)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6366f1' }}>{formatServiceAge(m.dateOfBirth)}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    {m.status
                      ? <span style={{ padding: '2px 8px', background: '#f0fdf4', color: '#166534', borderRadius: 12, fontSize: '0.78rem' }}>{m.status}</span>
                      : '—'}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{m.mobile ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', letterSpacing: '0.04em', color: '#6b7280' }}>{m.nationalId ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {canEdit && (
                      <button className="btn-sm" style={{ marginRight: 4 }}
                        onClick={async () => {
                          const full = await api.get<Member>(`/members/${m.id}`)
                          setEditMember(full.data)
                        }}>
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button className="btn-sm btn-danger"
                        disabled={deletingId === m.id}
                        onClick={() => handleDelete(m)}>
                        {deletingId === m.id ? '…' : 'Delete'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      {(showAdd || editMember) && (
        <MemberFormModal
          member={editMember}
          onSaved={handleSaved}
          onCancel={() => { setShowAdd(false); setEditMember(null) }}
        />
      )}
    </div>
  )
}
