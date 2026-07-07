import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import FamilyCreateForm from '../components/FamilyCreateForm'
import MemberFormModal from '../components/MemberFormModal'
import SearchBox from '../components/SearchBox'
import Pagination from '../components/Pagination'
import { useAuth } from '../auth'
import { useT } from '../i18n'
import type { Family, Member, PagedResponse } from '../types'

export default function FamiliesPage() {
  const [families, setFamilies]     = useState<Family[]>([])
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [query, setQuery]           = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editFamily, setEditFamily] = useState<Family | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const auth = useAuth()
  const { t } = useT()
  const navigate = useNavigate()

  const canCreate = auth.hasRole('SuperAdmin') || auth.hasRole('DataEntry')
  const isServant = auth.hasRole('Servant')
  const isMember = auth.user?.role === 'Member'

  // Members are auto-redirected to their own family
  useEffect(() => {
    if (!isMember) return
    api.get<PagedResponse<Family>>('/families', { params: { pageSize: 1 } })
      .then(r => {
        const items = r.data.items || []
        if (items.length === 1) {
          navigate(`/families/${items[0].id}`, { replace: true })
        }
      })
      .catch(() => {})
  }, [isMember])

  const load = () => {
    if (isMember) return // members are redirected above
    api.get<PagedResponse<Family>>('/families', { params: { q: query, page } })
      .then(r => { setFamilies(r.data.items || []); setTotalPages(r.data.totalPages || 1) })
      .catch(() => { setFamilies([]); setTotalPages(1) })
  }

  useEffect(load, [query, page])

  const handleSaved = (f: Family) => {
    setShowCreate(false)
    setEditFamily(null)
    setFamilies(prev => prev.some(x => x.id === f.id) ? prev.map(x => x.id === f.id ? f : x) : [f, ...prev])
  }

  const handleMemberSaved = (m: Member) => {
    setShowAddMember(false)
    navigate(`/members/${m.id}`)
  }

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <h2>{t('families.title')} {(isServant || isMember) && <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>{t('families.readOnly')}</span>}</h2>
          {canCreate && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={() => setShowCreate(true)}>
                {t('families.createFamily')}
              </button>
              <button className="btn-primary" onClick={() => setShowAddMember(true)} style={{ background: '#0891b2' }}>
                {t('members.addStandalone')}
              </button>
            </div>
          )}
        </div>

        <SearchBox value={query} onChange={v => { setQuery(v); setPage(1) }} />
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />

        <table className="table">
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('families.area')}</th>
              <th>{t('families.address')}</th>
              {!isServant && <th>{t('families.phone')}</th>}
              <th>{t('families.status')}</th>
              {canCreate && <th></th>}
            </tr>
          </thead>
          <tbody>
            {families.length === 0 && (
              <tr>
                <td colSpan={isServant ? 4 : (canCreate ? 6 : 5)} style={{ textAlign: 'center', color: '#888' }}>
                  {isServant
                    ? t('families.noFamiliesServant')
                    : <>{t('families.noFamilies')}{canCreate && <> {t('families.clickCreate')}</>}</>
                  }
                </td>
              </tr>
            )}
            {families.map(f => (
              <tr key={f.id}>
                <td>
                  <Link to={`/families/${f.id}`} style={{ color: '#4f46e5', fontWeight: 600 }}>
                    {f.familyName}
                  </Link>
                </td>
                <td>{f.area ?? '—'}</td>
                <td>{f.address ?? '—'}</td>
                {!isServant && <td>{f.phoneNumbers ?? '—'}</td>}
                <td>
                  {f.status && (
                    <span style={{
                      background: f.status === 'Active' ? '#dcfce7' : '#f1f5f9',
                      color:      f.status === 'Active' ? '#166534' : '#475569',
                      padding: '2px 10px', borderRadius: 99, fontSize: '0.8rem'
                    }}>
                      {f.status}
                    </span>
                  )}
                </td>
                {canCreate && (
                  <td>
                    <button className="btn-sm" onClick={() => setEditFamily(f)}>{t('common.edit')}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {(showCreate || editFamily) && (
          <FamilyCreateForm
            family={editFamily}
            onSaved={handleSaved}
            onCancel={() => { setShowCreate(false); setEditFamily(null) }}
          />
        )}

        {showAddMember && (
          <MemberFormModal
            member={null}
            onSaved={handleMemberSaved}
            onCancel={() => setShowAddMember(false)}
          />
        )}
      </div>
    </div>
  )
}
