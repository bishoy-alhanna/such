import React, { useEffect, useState } from 'react'
import api from '../services/api'
import Header from '../components/Header'
import SearchBox from '../components/SearchBox'
import Pagination from '../components/Pagination'
import UserFormModal from '../components/UserFormModal'
import SortTh from '../components/SortTh'
import { useSortableData } from '../hooks/useSortableData'
import { useAuth } from '../auth'
import { useT } from '../i18n'
import type { UserDto, PagedResponse } from '../types'

interface PendingUser {
  id: string
  username: string
  displayName?: string
  createdAt: string
  familyMemberId?: string
  roleName?: string
}

interface Role {
  id: string
  name: string
  description?: string
}

export default function UsersPage() {
  const [tab, setTab]               = useState<'all' | 'pending'>('all')

  // All users tab
  const [users, setUsers]           = useState<UserDto[]>([])
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [query, setQuery]           = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser]     = useState<UserDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null)
  const [deleting, setDeleting]     = useState(false)

  // Pending tab
  const [pending, setPending]           = useState<PendingUser[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [actionId, setActionId]         = useState<string | null>(null)
  const [roles, setRoles]               = useState<Role[]>([])

  // Approve modal
  const [approveTarget, setApproveTarget] = useState<PendingUser | null>(null)
  const [approveRoleId, setApproveRoleId] = useState('')
  const [approving, setApproving]         = useState(false)
  const [approveErr, setApproveErr]       = useState('')

  const auth = useAuth()
  const { t } = useT()

  const { sorted: sortedUsers, sortKey: userSortKey, sortDir: userSortDir, requestSort: requestUserSort } = useSortableData(users, 'username')
  const { sorted: sortedPending, sortKey: pendingSortKey, sortDir: pendingSortDir, requestSort: requestPendingSort } = useSortableData(pending, 'username')

  const load = () => {
    api.get<PagedResponse<UserDto>>('/users', { params: { q: query, page } })
      .then(r => { setUsers(r.data.items); setTotalPages(r.data.totalPages || 1) })
      .catch(() => { setUsers([]); setTotalPages(1) })
  }

  const loadPending = () => {
    setPendingLoading(true)
    Promise.all([
      api.get<PendingUser[]>('/users/pending'),
      api.get<Role[]>('/roles'),
    ]).then(([pRes, rRes]) => {
      setPending(pRes.data)
      setRoles(rRes.data)
      const member = rRes.data.find(r => r.name === 'Member')
      if (member) setApproveRoleId(member.id)
    }).catch(() => {}).finally(() => setPendingLoading(false))
  }

  useEffect(load, [query, page])

  useEffect(() => {
    if (tab === 'pending') loadPending()
  }, [tab])

  const handleCreated = (u: UserDto) => { setShowCreate(false); setUsers(prev => [u, ...prev]) }
  const handleUpdated = (u: UserDto) => { setEditUser(null); setUsers(prev => prev.map(x => x.id === u.id ? u : x)) }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/users/${deleteTarget.id}`)
      setUsers(prev => prev.filter(x => x.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      alert('Failed to delete user.')
    } finally {
      setDeleting(false)
    }
  }

  const openApprove = (u: PendingUser) => {
    setApproveTarget(u)
    const member = roles.find(r => r.name === 'Member')
    setApproveRoleId(member?.id ?? (roles[0]?.id ?? ''))
    setApproveErr('')
  }

  const confirmApprove = async () => {
    if (!approveTarget || !approveRoleId) return setApproveErr('Please select a role.')
    setApproving(true); setApproveErr('')
    try {
      await api.post(`/users/${approveTarget.id}/approve`, { roleId: approveRoleId })
      setPending(prev => prev.filter(u => u.id !== approveTarget.id))
      setApproveTarget(null)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setApproveErr(err?.response?.data?.message ?? 'Failed to approve user.')
    } finally {
      setApproving(false)
    }
  }

  const reject = async (id: string, username: string) => {
    if (!confirm(`Reject and delete registration for "${username}"?`)) return
    setActionId(id)
    try {
      await api.delete(`/users/${id}/reject`)
      setPending(prev => prev.filter(u => u.id !== id))
    } catch {
      alert('Failed to reject user.')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <h2>{t('users.title')}</h2>
          {auth.hasRole('SuperAdmin') && tab === 'all' && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>{t('users.addUser')}</button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className={`btn-sm${tab === 'all' ? ' btn-primary' : ''}`} onClick={() => setTab('all')}>
            {t('users.allUsers')}
          </button>
          <button className={`btn-sm${tab === 'pending' ? ' btn-primary' : ''}`} onClick={() => setTab('pending')}>
            {t('users.pending')}
            {pending.length > 0 && (
              <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: '0.75rem', fontWeight: 700 }}>
                {pending.length}
              </span>
            )}
          </button>
        </div>

        {/* ── All users ── */}
        {tab === 'all' && (
          <>
            <SearchBox value={query} onChange={v => { setQuery(v); setPage(1) }} />
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            <table className="table">
              <thead>
                <tr>
                  <SortTh label={t('users.username')} field="username" current={userSortKey} dir={userSortDir} onSort={requestUserSort} />
                  <SortTh label={t('users.displayName')} field="displayName" current={userSortKey} dir={userSortDir} onSort={requestUserSort} />
                  <th>Role ID</th>
                  {auth.hasRole('SuperAdmin') && <th>{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {sortedUsers.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: '#888' }}>{t('users.noUsers')}</td></tr>
                )}
                {sortedUsers.map(u => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.displayName ?? '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8em' }}>{u.roleId}</td>
                    {auth.hasRole('SuperAdmin') && (
                      <td>
                        <button className="btn-sm" onClick={() => setEditUser(u)}>{t('common.edit')}</button>
                        {' '}
                        <button className="btn-sm btn-danger" onClick={() => setDeleteTarget(u)}>{t('common.delete')}</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── Pending approvals ── */}
        {tab === 'pending' && (
          <>
            {pendingLoading ? (
              <p style={{ color: '#888' }}>{t('common.loading')}</p>
            ) : pending.length === 0 ? (
              <p style={{ color: '#888', fontStyle: 'italic' }}>{t('users.noPending')}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <SortTh label={t('users.username')} field="username" current={pendingSortKey} dir={pendingSortDir} onSort={requestPendingSort} />
                    <SortTh label={t('users.displayName')} field="displayName" current={pendingSortKey} dir={pendingSortDir} onSort={requestPendingSort} />
                    <SortTh label={t('users.registeredAt')} field="createdAt" current={pendingSortKey} dir={pendingSortDir} onSort={requestPendingSort} />
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPending.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.username}</td>
                      <td>{u.displayName ?? '—'}</td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{new Date(u.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          className="btn-sm btn-primary"
                          onClick={() => openApprove(u)}
                          disabled={actionId === u.id}
                          style={{ marginRight: 6 }}
                        >
                          {t('users.approve')}
                        </button>
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => reject(u.id, u.username)}
                          disabled={actionId === u.id}
                        >
                          {t('users.reject')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* Approve modal */}
        {approveTarget && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{t('users.approveTitle', { username: approveTarget.username })}</h3>
              <p style={{ color: '#64748b', marginBottom: 12 }}>
                {approveTarget.displayName && <><strong>{approveTarget.displayName}</strong><br /></>}
                {t('users.selectRoleHint')}
              </p>
              <label>{t('users.roleLabel')}</label>
              <select value={approveRoleId} onChange={e => setApproveRoleId(e.target.value)}>
                <option value="">{t('users.selectRole')}</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}{r.description ? ` — ${r.description}` : ''}</option>)}
              </select>
              {approveErr && <div className="error" style={{ marginTop: 8 }}>{approveErr}</div>}
              <div className="modal-actions">
                <button className="btn-primary" onClick={confirmApprove} disabled={approving || !approveRoleId}>
                  {approving ? t('users.approving') : t('users.approveActivate')}
                </button>
                <button onClick={() => setApproveTarget(null)} disabled={approving}>{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Create / Edit modals */}
        {showCreate && <UserFormModal user={null} onSaved={handleCreated} onCancel={() => setShowCreate(false)} />}
        {editUser   && <UserFormModal user={editUser} onSaved={handleUpdated} onCancel={() => setEditUser(null)} />}

        {/* Delete confirmation */}
        {deleteTarget && (
          <div className="modal-backdrop">
            <div className="modal">
              <h3>{t('users.deleteUser')}</h3>
              <p>{t('users.deleteConfirm', { username: deleteTarget.username })}</p>
              <div className="modal-actions">
                <button className="btn-danger" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? t('family.deleting') : t('common.yes') + ', ' + t('common.delete').toLowerCase()}
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
