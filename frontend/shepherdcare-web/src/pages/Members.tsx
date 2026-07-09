import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
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
import { useT } from '../i18n'

interface MemberRow {
  id: string
  fullName: string
  familyId?: string
  familyName?: string
  familyAddress?: string
  familyArea?: string
  familyPhone?: string
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

interface GroupOption { id: string; name: string; classes: { id: string; className: string }[] }

export default function MembersPage() {
  const auth = useAuth()
  const { t } = useT()
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

  const [showExport, setShowExport]       = useState(false)
  const [exportFormat, setExportFormat]   = useState<'excel' | 'pdf'>('excel')
  const [exportScope, setExportScope]     = useState<'current' | 'class' | 'group'>('current')
  const [exportGroupId, setExportGroupId] = useState('')
  const [exportClassId, setExportClassId] = useState('')
  const [exportGroups, setExportGroups]   = useState<GroupOption[]>([])
  const [exportLoading, setExportLoading] = useState(false)

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
    if (!confirm(t('membersPage.confirmDelete' as any, { name: m.fullName }))) return
    setDeletingId(m.id)
    try {
      await api.delete(`/members/${m.id}`, { params: { scope: 'family' } })
      setMembers(prev => prev.filter(x => x.id !== m.id))
      setTotal(v => v - 1)
    } catch {
      alert(t('common.error'))
    } finally {
      setDeletingId(null)
    }
  }

  const openExport = async () => {
    setShowExport(true)
    if (exportGroups.length === 0) {
      try {
        const r = await api.get<GroupOption[]>('/groups')
        setExportGroups(Array.isArray(r.data) ? r.data : [])
      } catch { /* non-fatal */ }
    }
  }

  const runExport = async () => {
    setExportLoading(true)
    try {
      const params: Record<string, string | boolean> = { exportAll: true }
      if (exportScope === 'current') {
        if (query)  params.q      = query
        if (filter) params.filter = filter
        if (gender) params.gender = gender
      } else if (exportScope === 'class' && exportClassId) {
        params.classId = exportClassId
      } else if (exportScope === 'group' && exportGroupId) {
        params.groupId = exportGroupId
      }

      const r = await api.get<{ items: MemberRow[] }>('/members', { params })
      const rows = r.data.items

      const colName        = t('export.colName' as any)
      const colGender      = t('export.colGender' as any)
      const colDOB         = t('export.colDOB' as any)
      const colMobile      = t('export.colMobile' as any)
      const colFamily      = t('export.colFamily' as any)
      const colFamilyPhone = t('export.colFamilyPhone' as any)
      const colAddress     = t('export.colAddress' as any)
      const colArea        = t('export.colArea' as any)
      const colStatus      = t('export.colStatus' as any)
      const colRelation    = t('export.colRelation' as any)

      const data = rows.map(m => ({
        [colName]:        m.fullName,
        [colGender]:      m.gender ?? '',
        [colDOB]:         m.dateOfBirth ? m.dateOfBirth.split('T')[0] : '',
        [colMobile]:      m.mobile ?? '',
        [colFamily]:      m.familyName ?? '',
        [colFamilyPhone]: m.familyPhone ?? '',
        [colAddress]:     m.familyAddress ?? '',
        [colArea]:        m.familyArea ?? '',
        [colStatus]:      m.status ?? '',
        [colRelation]:    m.relation ?? '',
      }))

      const filename = t('export.filename' as any)

      if (exportFormat === 'excel') {
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Members')
        XLSX.writeFile(wb, `${filename}.xlsx`)
      } else {
        const headers = [colName, colGender, colDOB, colMobile, colFamily, colFamilyPhone, colAddress, colArea, colStatus, colRelation]
        const rowsHtml = data.map(row =>
          `<tr>${headers.map(h => `<td>${String(row[h] ?? '').replace(/</g, '&lt;')}</td>`).join('')}</tr>`
        ).join('')
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title>
<style>body{font-family:Arial,sans-serif;margin:15mm}h2{margin-bottom:10px;font-size:14pt}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 7px;font-size:9pt;text-align:start}
th{background:#f3f4f6;font-weight:bold}@media print{body{margin:10mm}}</style></head>
<body><h2>${filename}</h2><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>${rowsHtml}</tbody></table>
<script>window.onload=()=>{window.print()}<\/script></body></html>`
        const win = window.open('', '_blank')
        if (win) { win.document.write(html); win.document.close() }
      }

      setShowExport(false)
    } catch {
      alert(t('common.error'))
    } finally {
      setExportLoading(false)
    }
  }

  const exportClassOptions = exportScope === 'class'
    ? exportGroups.flatMap(g => g.classes)
    : exportGroups.find(g => g.id === exportGroupId)?.classes ?? []

  const refYear = sep15RefYear()

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <div>
            <h2>{t('membersPage.title' as any)}</h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{t('membersPage.total' as any, { n: total })}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-sm" onClick={openExport}>⬇ {t('export.exportBtn' as any)}</button>
            {canEdit && (
              <button className="btn-primary" onClick={() => setShowAdd(true)}>{t('membersPage.addMember' as any)}</button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <SearchBox value={query} onChange={v => { setQuery(v); setPage(1) }} />
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }}
            style={{ minWidth: 150 }}>
            <option value="">{t('membersPage.allMembers' as any)}</option>
            <option value="withFamily">{t('membersPage.withFamily' as any)}</option>
            <option value="withoutFamily">{t('membersPage.withoutFamily' as any)}</option>
          </select>
          <select value={gender} onChange={e => { setGender(e.target.value); setPage(1) }}
            style={{ minWidth: 120 }}>
            <option value="">{t('common.all')}</option>
            <option value="Male">{t('members.genderMale')}</option>
            <option value="Female">{t('members.genderFemale')}</option>
          </select>
        </div>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />

        {loading && <p style={{ color: '#888', padding: '8px 0' }}>{t('common.loading')}</p>}

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <SortTh label={t('members.fullName')}   field="fullName"   current={sortKey} dir={sortDir} onSort={requestSort} />
                <SortTh label={t('membersPage.family' as any)} field="familyName" current={sortKey} dir={sortDir} onSort={requestSort} />
                <SortTh label={t('members.relation')}  field="relation"   current={sortKey} dir={sortDir} onSort={requestSort} />
                <SortTh label={t('members.gender')} field="gender" current={sortKey} dir={sortDir} onSort={requestSort} />
                <th style={{ whiteSpace: 'nowrap' }}>
                  {t('membersPage.realAge' as any)} <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 400 }}>/ Sep {refYear}</span>
                </th>
                <SortTh label={t('members.status')}    field="status"     current={sortKey} dir={sortDir} onSort={requestSort} />
                <SortTh label={t('members.mobile')}    field="mobile"     current={sortKey} dir={sortDir} onSort={requestSort} />
                <SortTh label={t('members.nationalId')} field="nationalId" current={sortKey} dir={sortDir} onSort={requestSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>{t('membersPage.noMembers' as any)}</td></tr>
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
                      : <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>{t('membersPage.withoutFamily' as any)}</span>}
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
                        {t('common.edit')}
                      </button>
                    )}
                    {canDelete && (
                      <button className="btn-sm btn-danger"
                        disabled={deletingId === m.id}
                        onClick={() => handleDelete(m)}>
                        {deletingId === m.id ? '…' : t('common.delete')}
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

      {showExport && (
        <div className="modal-overlay" onClick={() => setShowExport(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 20 }}>{t('export.title' as any)}</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('export.format' as any)}</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['excel', 'pdf'] as const).map(f => (
                  <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="radio" name="exportFormat" value={f} checked={exportFormat === f}
                      onChange={() => setExportFormat(f)} />
                    {f === 'excel' ? t('export.excel' as any) : t('export.pdf' as any)}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t('export.scope' as any)}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(['current', 'class', 'group'] as const).map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="radio" name="exportScope" value={s} checked={exportScope === s}
                      onChange={() => { setExportScope(s); setExportGroupId(''); setExportClassId('') }} />
                    {s === 'current' ? t('export.scopeCurrent' as any) : s === 'class' ? t('export.scopeClass' as any) : t('export.scopeGroup' as any)}
                  </label>
                ))}
              </div>
            </div>

            {exportScope === 'group' && (
              <div style={{ marginBottom: 14 }}>
                <select value={exportGroupId} onChange={e => setExportGroupId(e.target.value)} style={{ width: '100%' }}>
                  <option value="">{t('export.selectGroup' as any)}</option>
                  {exportGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}

            {(exportScope === 'class' || (exportScope === 'group' && exportGroupId)) && (
              <div style={{ marginBottom: 14 }}>
                {exportScope === 'group' && exportGroupId && (
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('export.scopeClass' as any)}</label>
                  </div>
                )}
                <select value={exportClassId} onChange={e => setExportClassId(e.target.value)} style={{ width: '100%' }}>
                  <option value="">{exportScope === 'group' ? `— ${t('export.scopeCurrent' as any)} (${t('export.scopeGroup' as any)})` : t('export.selectClass' as any)}</option>
                  {exportClassOptions.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn-sm" onClick={() => setShowExport(false)}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={runExport} disabled={exportLoading ||
                (exportScope === 'class' && !exportClassId) ||
                (exportScope === 'group' && !exportGroupId)}>
                {exportLoading ? t('export.loading' as any) : `⬇ ${t('export.exportBtn' as any)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
