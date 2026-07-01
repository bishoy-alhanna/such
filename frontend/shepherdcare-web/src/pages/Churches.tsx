import React, { useEffect, useState } from 'react'
import Header from '../components/Header'
import api from '../services/api'
import { useT } from '../i18n'

const PLAN_NAMES  = ['Trial', 'Starter', 'Church', 'Parish', 'Diocese']
const STATUS_NAMES  = ['Trial', 'Active', 'Past Due', 'Suspended']
const STATUS_BG   = ['#fef3c7','#d1fae5','#fff7ed','#f3f4f6']
const STATUS_FG   = ['#92400e','#065f46','#9a3412','#374151']
const BILLING     = ['Monthly', 'Annual']

interface ChurchSubscription {
  plan: number; status: number; billingCycle: number
  daysLeftInTrial: number; trialEndsAt: string
  memberLimit: number; servantLimit: number
  monthlyPrice: number; annualPrice: number
  usage: { memberCount: number; memberPct: number; servantCount: number; servantPct: number }
}

interface ChurchAdmin {
  id: string
  username: string
  displayName?: string
  isActive: boolean
  pendingApproval: boolean
}

interface Church {
  id: string
  name: string
  slug: string
  isActive: boolean
  logoUrl?: string
  contactEmail?: string
  city?: string
  country?: string
  createdAt: string
  adminUsername?: string
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
}

function AdminPanel({ church, onClose }: { church: Church; onClose: () => void }) {
  const [tab, setTab]             = useState<'admin' | 'subscription'>('admin')
  const [admin, setAdmin]         = useState<ChurchAdmin | null>(null)
  const [sub, setSub]             = useState<ChurchSubscription | null>(null)
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState(false)
  const [newPwd, setNewPwd]       = useState('')
  const [pwdErr, setPwdErr]       = useState('')
  const [pwdOk, setPwdOk]         = useState(false)
  const [err, setErr]             = useState('')
  const [subBusy, setSubBusy]     = useState(false)
  const [subMsg, setSubMsg]       = useState('')

  useEffect(() => {
    Promise.all([
      api.get<ChurchAdmin>(`/churches/${church.id}/admin`).then(r => setAdmin(r.data)).catch(() => {}),
      api.get<ChurchSubscription>(`/subscription/church/${church.id}`).then(r => setSub(r.data)).catch(() => {}),
    ]).catch(() => setErr('Failed to load church details.')).finally(() => setLoading(false))
  }, [church.id])

  const updateSub = async (patch: Partial<{ plan: number; status: number; billingCycle: number }>) => {
    setSubBusy(true); setSubMsg('')
    try {
      const res = await api.put<ChurchSubscription>(`/subscription/church/${church.id}`, patch)
      setSub(res.data); setSubMsg('Saved.')
    } catch { setSubMsg('Failed to save.') }
    finally { setSubBusy(false) }
  }

  const toggleStatus = async () => {
    if (!admin) return
    setBusy(true)
    try {
      const res = await api.patch<ChurchAdmin>(`/churches/${church.id}/admin/status`, { isActive: !admin.isActive })
      setAdmin(res.data)
    } catch { setErr('Failed to update admin status.') }
    finally { setBusy(false) }
  }

  const resetPassword = async () => {
    setPwdErr(''); setPwdOk(false)
    if (newPwd.length < 8) { setPwdErr('Password must be at least 8 characters.'); return }
    setBusy(true)
    try {
      await api.post(`/churches/${church.id}/admin/reset-password`, { newPassword: newPwd })
      setNewPwd('')
      setPwdOk(true)
    } catch { setPwdErr('Failed to reset password.') }
    finally { setBusy(false) }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...modal, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{church.name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e5e7eb', flexShrink: 0 }}>
          {(['admin', 'subscription'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', padding: '6px 14px',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              borderBottom: tab === t ? '2px solid #4f46e5' : '2px solid transparent',
              color: tab === t ? '#4f46e5' : '#6b7280',
              marginBottom: -2, textTransform: 'capitalize',
            }}>{t === 'admin' ? 'Admin Account' : 'Subscription'}</button>
          ))}
        </div>

        {err && <div style={alertErr}>{err}</div>}
        {loading && <div style={{ color: '#6b7280', textAlign: 'center', padding: 24 }}>Loading…</div>}

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── Admin tab ── */}
          {tab === 'admin' && admin && (
            <>
              <div style={infoGrid}>
                <div style={infoItem}>
                  <span style={infoLabel}>Username</span>
                  <code style={infoVal}>{admin.username}</code>
                </div>
                <div style={infoItem}>
                  <span style={infoLabel}>Display Name</span>
                  <span style={infoVal}>{admin.displayName || '—'}</span>
                </div>
                <div style={infoItem}>
                  <span style={infoLabel}>Account Status</span>
                  <span style={{
                    ...badge,
                    background: admin.pendingApproval ? '#fef3c7' : admin.isActive ? '#d1fae5' : '#fee2e2',
                    color: admin.pendingApproval ? '#92400e' : admin.isActive ? '#065f46' : '#991b1b',
                  }}>
                    {admin.pendingApproval ? 'Pending Approval' : admin.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>

              <hr style={divider} />

              <div style={{ marginBottom: 20 }}>
                <p style={sectionTitle}>Account Access</p>
                <button
                  style={{
                    ...actionBtn,
                    background: admin.isActive ? '#fee2e2' : '#d1fae5',
                    color: admin.isActive ? '#991b1b' : '#065f46',
                    border: `1px solid ${admin.isActive ? '#fca5a5' : '#6ee7b7'}`,
                  }}
                  disabled={busy || admin.pendingApproval}
                  onClick={toggleStatus}
                >
                  {busy ? '…' : admin.isActive ? 'Disable Admin Account' : 'Enable Admin Account'}
                </button>
                {admin.pendingApproval && (
                  <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                    Activate the church first to enable the admin account.
                  </p>
                )}
              </div>

              <hr style={divider} />

              <div>
                <p style={sectionTitle}>Reset Password</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="password"
                    placeholder="New password (min 8 chars)"
                    value={newPwd}
                    onChange={e => { setNewPwd(e.target.value); setPwdErr(''); setPwdOk(false) }}
                    style={pwdInput}
                    autoComplete="new-password"
                  />
                  <button style={actionBtn} disabled={busy || !newPwd} onClick={resetPassword}>
                    {busy ? '…' : 'Reset'}
                  </button>
                </div>
                {pwdErr && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{pwdErr}</p>}
                {pwdOk  && <p style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>Password updated successfully.</p>}
              </div>
            </>
          )}

          {/* ── Subscription tab ── */}
          {tab === 'subscription' && (
            <>
              {sub ? (
                <>
                  {/* Status + usage summary */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                    <div style={{ flex: 1, background: '#f9fafb', borderRadius: 8, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}>PLAN</div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#1e1b4b' }}>{PLAN_NAMES[sub.plan]}</div>
                    </div>
                    <div style={{ flex: 1, background: STATUS_BG[sub.status], borderRadius: 8, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}>STATUS</div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: STATUS_FG[sub.status] }}>{STATUS_NAMES[sub.status]}</div>
                    </div>
                    <div style={{ flex: 1, background: '#f9fafb', borderRadius: 8, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}>BILLING</div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#1e1b4b' }}>{BILLING[sub.billingCycle]}</div>
                    </div>
                  </div>

                  {/* Usage */}
                  <div style={{ marginBottom: 20 }}>
                    {[
                      { label: 'Members', count: sub.usage.memberCount, limit: sub.memberLimit, pct: sub.usage.memberPct },
                      { label: 'Staff',   count: sub.usage.servantCount, limit: sub.servantLimit, pct: sub.usage.servantPct },
                    ].map(u => (
                      <div key={u.label} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{u.label}</span>
                          <span style={{ color: '#6b7280' }}>{u.count} / {u.limit === -1 ? '∞' : u.limit}</span>
                        </div>
                        {u.limit !== -1 && (
                          <div style={{ background: '#e5e7eb', borderRadius: 99, height: 6 }}>
                            <div style={{
                              width: `${Math.min(u.pct, 100)}%`, height: 6, borderRadius: 99,
                              background: u.pct >= 100 ? '#dc2626' : u.pct >= 80 ? '#f59e0b' : '#4f46e5',
                            }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <hr style={divider} />

                  {/* Controls */}
                  <p style={sectionTitle}>Change Plan</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Plan</label>
                      <select
                        value={sub.plan}
                        onChange={e => updateSub({ plan: +e.target.value })}
                        disabled={subBusy}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                      >
                        {PLAN_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Status</label>
                      <select
                        value={sub.status}
                        onChange={e => updateSub({ status: +e.target.value })}
                        disabled={subBusy}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                      >
                        {STATUS_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Billing</label>
                      <select
                        value={sub.billingCycle}
                        onChange={e => updateSub({ billingCycle: +e.target.value })}
                        disabled={subBusy}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                      >
                        <option value={0}>Monthly</option>
                        <option value={1}>Annual</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      {subMsg && <span style={{ fontSize: 12, color: subMsg === 'Saved.' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{subMsg}</span>}
                    </div>
                  </div>

                  {sub.status === 0 && (
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 0 }}>
                      Trial ends: <strong>{new Date(sub.trialEndsAt).toLocaleDateString()}</strong>
                      {' · '}{sub.daysLeftInTrial} days left
                    </p>
                  )}
                </>
              ) : (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: 32 }}>No subscription found.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChurchesPage() {
  const { t } = useT()
  const [churches, setChurches]       = useState<Church[]>([])
  const [loading, setLoading]         = useState(true)
  const [err, setErr]                 = useState('')
  const [busy, setBusy]               = useState<string | null>(null)
  const [adminPanel, setAdminPanel]   = useState<Church | null>(null)

  const load = () => {
    setLoading(true)
    api.get<Church[]>('/churches')
      .then(r => { setChurches(r.data); setErr('') })
      .catch(() => setErr('Failed to load churches.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const toggleActive = async (c: Church) => {
    setBusy(c.id)
    try {
      const res = await api.patch<Church>(`/churches/${c.id}`, { isActive: !c.isActive })
      setChurches(prev => prev.map(x => x.id === c.id ? res.data : x))
    } catch {
      alert('Failed to update church.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="app-layout">
      <Header />
      <main className="container">
        <div className="page-header">
          <h1 className="page-title">⛪ {t('nav.churches')}</h1>
          <a href="/register-church" target="_blank" rel="noreferrer" className="btn btn-secondary">
            + Register New Church
          </a>
        </div>

        {err && <div className="alert alert-error">{err}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>Loading…</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>City</th>
                  <th>Contact</th>
                  <th>Admin Account</th>
                  <th>Registered</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {churches.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af' }}>No churches yet.</td></tr>
                )}
                {churches.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>
                      <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
                        {c.slug}
                      </code>
                    </td>
                    <td>{[c.city, c.country].filter(Boolean).join(', ') || '—'}</td>
                    <td>{c.contactEmail || '—'}</td>
                    <td>
                      {c.adminUsername
                        ? <code style={{ fontSize: 12, color: '#4f46e5' }}>{c.adminUsername}</code>
                        : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td>{fmt(c.createdAt)}</td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 600,
                        background: c.isActive ? '#d1fae5' : '#fee2e2',
                        color: c.isActive ? '#065f46' : '#991b1b',
                      }}>
                        {c.isActive ? 'Active' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className={`btn btn-sm ${c.isActive ? 'btn-danger' : 'btn-primary'}`}
                          disabled={busy === c.id}
                          onClick={() => toggleActive(c)}
                        >
                          {busy === c.id ? '…' : c.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setAdminPanel(c)}
                          title="Manage admin account"
                        >
                          Admin
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {adminPanel && <AdminPanel church={adminPanel} onClose={() => setAdminPanel(null)} />}
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
}
const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '28px 28px 24px',
  width: '100%', maxWidth: 460, boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
}
const infoGrid: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }
const infoItem: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const infoLabel: React.CSSProperties = { fontSize: 13, color: '#6b7280', fontWeight: 500 }
const infoVal: React.CSSProperties = { fontSize: 14, color: '#111827', fontWeight: 600 }
const badge: React.CSSProperties = { padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600 }
const divider: React.CSSProperties = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10, marginTop: 0 }
const actionBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db',
  background: '#f9fafb', cursor: 'pointer', fontSize: 13, fontWeight: 600,
}
const alertErr: React.CSSProperties = {
  background: '#fee2e2', color: '#991b1b', padding: '10px 14px',
  borderRadius: 8, marginBottom: 16, fontSize: 14,
}
const pwdInput: React.CSSProperties = {
  flex: 1, border: '1px solid #d1d5db', borderRadius: 8,
  padding: '8px 12px', fontSize: 13, outline: 'none',
}
