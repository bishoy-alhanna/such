import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Header from '../components/Header'
import api from '../services/api'
import { useT } from '../i18n'

interface AuditEntry {
  id: string
  timestamp: string
  action: string
  performedBy: string
  entity: string
  entityId: string
  details: string
}

interface AuditDetail extends AuditEntry {
  currentEntityData?: Record<string, any> | null
  navLink?: string | null
}

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  LoginSuccess:          { bg: '#dcfce7', color: '#166534' },
  LoginFailed:           { bg: '#fee2e2', color: '#991b1b' },
  CreateFamily:          { bg: '#dbeafe', color: '#1e40af' },
  UpdateFamily:          { bg: '#e0e7ff', color: '#3730a3' },
  DeleteFamily:          { bg: '#fee2e2', color: '#991b1b' },
  CreateFamilyFromMember:{ bg: '#dbeafe', color: '#1e40af' },
  CreateMember:          { bg: '#dbeafe', color: '#1e40af' },
  UpdateMember:          { bg: '#e0e7ff', color: '#3730a3' },
  DeleteMember:          { bg: '#fee2e2', color: '#991b1b' },
  BulkAttendance:        { bg: '#dcfce7', color: '#166534' },
  CreateAttendance:      { bg: '#dcfce7', color: '#166534' },
  UpdateAttendance:      { bg: '#e0e7ff', color: '#3730a3' },
  DeleteAttendance:      { bg: '#fee2e2', color: '#991b1b' },
  CreateUser:            { bg: '#dbeafe', color: '#1e40af' },
  UpdateUser:            { bg: '#e0e7ff', color: '#3730a3' },
  DeleteUser:            { bg: '#fee2e2', color: '#991b1b' },
  CreateClass:           { bg: '#dbeafe', color: '#1e40af' },
  UpdateClass:           { bg: '#e0e7ff', color: '#3730a3' },
  CreateGroup:           { bg: '#dbeafe', color: '#1e40af' },
  UpdateGroup:           { bg: '#e0e7ff', color: '#3730a3' },
}

function actionStyle(action: string) {
  return ACTION_COLORS[action] ?? { bg: '#f3f4f6', color: '#374151' }
}

function formatKey(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
}

// ── Detail Modal ────────────────────────────────────────────────
function DetailModal({ entry, onClose }: { entry: AuditDetail; onClose: () => void }) {
  const style = actionStyle(entry.action)

  const fields: [string, string][] = [
    ['Timestamp',    new Date(entry.timestamp).toLocaleString()],
    ['Performed By', entry.performedBy],
    ['Entity Type',  entry.entity],
    ['Entity ID',    entry.entityId || '—'],
    ['Details',      entry.details  || '—'],
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '20px'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'white', borderRadius: '12px', width: '100%', maxWidth: '560px',
        maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
        }}>
          <div>
            <span style={{
              padding: '4px 12px', borderRadius: '6px', fontSize: '13px',
              fontWeight: 700, backgroundColor: style.bg, color: style.color
            }}>
              {entry.action}
            </span>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
              {new Date(entry.timestamp).toLocaleString()}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '20px',
            cursor: 'pointer', color: '#9ca3af', padding: '0 4px', lineHeight: 1
          }}>✕</button>
        </div>

        {/* Core fields */}
        <div style={{ padding: '20px 24px' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '13px', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>
            Audit Entry
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px 12px', fontSize: '14px' }}>
            {fields.map(([label, value]) => (
              <React.Fragment key={label}>
                <span style={{ color: '#6b7280', fontWeight: 500 }}>{label}</span>
                <span style={{
                  wordBreak: 'break-all',
                  fontFamily: label === 'Entity ID' ? 'monospace' : undefined,
                  fontSize: label === 'Entity ID' ? '12px' : undefined
                }}>{value}</span>
              </React.Fragment>
            ))}
          </div>

          {/* Current entity data */}
          {entry.currentEntityData && Object.keys(entry.currentEntityData).length > 0 && (
            <>
              <div style={{ borderTop: '1px solid #f1f5f9', margin: '20px 0 16px' }} />
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>
                Current {entry.entity} Data
              </h4>
              <div style={{
                background: '#f8fafc', borderRadius: '8px', padding: '14px 16px',
                display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px 12px', fontSize: '13px'
              }}>
                {Object.entries(entry.currentEntityData)
                  .filter(([, v]) => v !== null && v !== undefined && v !== '')
                  .map(([key, value]) => (
                    <React.Fragment key={key}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>{formatKey(key)}</span>
                      <span style={{
                        wordBreak: 'break-all',
                        fontFamily: key.toLowerCase().includes('id') ? 'monospace' : undefined,
                        fontSize: key.toLowerCase().includes('id') ? '11px' : undefined
                      }}>
                        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                      </span>
                    </React.Fragment>
                  ))}
              </div>
            </>
          )}

          {entry.currentEntityData === null && (
            <p style={{ color: '#ef4444', fontSize: '13px', margin: '16px 0 0', padding: '10px 14px', background: '#fee2e2', borderRadius: '6px' }}>
              ⚠️ This record no longer exists (may have been deleted).
            </p>
          )}

          {/* Navigation link */}
          {entry.navLink && (
            <div style={{ marginTop: '20px' }}>
              <Link
                to={entry.navLink}
                onClick={onClose}
                className="btn btn-primary"
                style={{ fontSize: '13px', textDecoration: 'none', display: 'inline-block' }}
              >
                → Go to {entry.entity}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────
export default function AuditPage() {
  const { user } = useAuth()
  const { t } = useT()
  const userRole = user?.role ?? ''

  const [entries, setEntries]   = useState<AuditEntry[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)

  const [search, setSearch]               = useState('')
  const [filterAction, setFilterAction]   = useState('')
  const [filterEntity, setFilterEntity]   = useState('')
  const [filterUser, setFilterUser]       = useState('')
  const [fromDate, setFromDate]           = useState('')
  const [toDate, setToDate]               = useState('')
  const [actionOptions, setActionOptions] = useState<string[]>([])
  const [entityOptions, setEntityOptions] = useState<string[]>([])

  const [detailEntry, setDetailEntry]     = useState<AuditDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const pageSize = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, pageSize }
      if (search)       params.search      = search
      if (filterAction) params.action      = filterAction
      if (filterEntity) params.entity      = filterEntity
      if (filterUser)   params.performedBy = filterUser
      if (fromDate)     params.from        = fromDate
      if (toDate)       params.to          = toDate
      const res = await api.get('/audit', { params })
      setEntries(res.data.items)
      setTotal(res.data.total)
      if (res.data.actions?.length)  setActionOptions(res.data.actions)
      if (res.data.entities?.length) setEntityOptions(res.data.entities)
    } catch {
      setEntries([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, filterAction, filterEntity, filterUser, fromDate, toDate])

  useEffect(() => { fetchLogs() }, [fetchLogs])
  useEffect(() => { setPage(1) }, [search, filterAction, filterEntity, filterUser, fromDate, toDate])

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await api.get(`/audit/${id}`)
      setDetailEntry(res.data)
    } catch {
      const row = entries.find(e => e.id === id)
      if (row) setDetailEntry({ ...row, currentEntityData: null, navLink: null })
    } finally {
      setDetailLoading(false)
    }
  }

  if (userRole !== 'SuperAdmin') {
    return (
      <div><Header />
        <div className="container">
          <div className="page-header"><h2>🔍 {t('audit.title')}</h2></div>
          <p style={{ textAlign: 'center', color: '#888', marginTop: '2rem' }}>{t('audit.adminOnly')}</p>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <h2>🔍 {t('audit.title')}</h2>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>{t('audit.total', { n: total.toLocaleString() })}</span>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            <div><label>{t('common.search')}</label><input placeholder={t('audit.search')} value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div>
              <label>{t('audit.action')}</label>
              <select value={filterAction} onChange={e => setFilterAction(e.target.value)}>
                <option value="">{t('audit.allActions')}</option>
                {actionOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label>{t('audit.entity')}</label>
              <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}>
                <option value="">{t('audit.allEntities')}</option>
                {entityOptions.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div><label>{t('audit.performedBy')}</label><input placeholder={t('audit.usernamePlaceholder')} value={filterUser} onChange={e => setFilterUser(e.target.value)} /></div>
            <div><label>{t('audit.from')}</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
            <div><label>{t('audit.to')}</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
          </div>
          {(search || filterAction || filterEntity || filterUser || fromDate || toDate) && (
            <button className="btn btn-secondary" style={{ marginTop: '10px', fontSize: '12px' }}
              onClick={() => { setSearch(''); setFilterAction(''); setFilterEntity(''); setFilterUser(''); setFromDate(''); setToDate('') }}>
              {t('audit.clearFilters')}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#888' }}>{t('common.loading')}</p>
          ) : entries.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#888' }}>{t('audit.noEntries')}</p>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ tableLayout: 'fixed', minWidth: '800px' }}>
                  <colgroup>
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '33%' }} />
                    <col style={{ width: '10%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>{t('audit.timestamp')}</th><th>{t('audit.action')}</th><th>{t('audit.performedBy')}</th>
                      <th>{t('audit.entity')}</th><th>{t('audit.details')}</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(entry => {
                      const s = actionStyle(entry.action)
                      return (
                        <tr key={entry.id}>
                          <td style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {new Date(entry.timestamp).toLocaleString()}
                          </td>
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                              {entry.action}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.performedBy}</td>
                          <td style={{ color: '#6b7280', fontSize: '13px' }}>{entry.entity}</td>
                          <td style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.details}>{entry.details || '—'}</td>
                          <td>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '11px', padding: '3px 10px', whiteSpace: 'nowrap' }}
                              onClick={() => openDetail(entry.id)}
                              disabled={detailLoading}
                            >
                              {detailLoading ? '…' : t('reports.view')}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <button className="btn btn-secondary" onClick={() => setPage(1)} disabled={page === 1} style={{ fontSize: '12px' }}>«</button>
                  <button className="btn btn-secondary" onClick={() => setPage(p => p - 1)} disabled={page === 1} style={{ fontSize: '12px' }}>‹ Prev</button>
                  <span style={{ fontSize: '13px', color: '#6b7280', padding: '0 8px' }}>{t('common.page', { n: page, total: totalPages })}</span>
                  <button className="btn btn-secondary" onClick={() => setPage(p => p + 1)} disabled={page === totalPages} style={{ fontSize: '12px' }}>Next ›</button>
                  <button className="btn btn-secondary" onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ fontSize: '12px' }}>»</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {detailEntry && <DetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} />}
    </div>
  )
}
