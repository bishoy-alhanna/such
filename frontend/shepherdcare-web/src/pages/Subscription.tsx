import React, { useEffect, useState } from 'react'
import Header from '../components/Header'
import api from '../services/api'

interface SubscriptionUsage {
  memberCount: number
  memberLimit: number
  memberPct: number
  servantCount: number
  servantLimit: number
  servantPct: number
}

interface SubscriptionData {
  id: string
  churchName: string
  plan: number        // 0=Trial 1=Starter 2=Church 3=Parish 4=Diocese
  status: number      // 0=Trial 1=Active 2=PastDue 3=Suspended
  billingCycle: number // 0=Monthly 1=Annual
  trialEndsAt: string
  daysLeftInTrial: number
  periodStart?: string
  periodEnd?: string
  memberLimit: number
  servantLimit: number
  monthlyPrice: number
  annualPrice: number
  notes?: string
  usage: SubscriptionUsage
}

const PLAN_NAMES = ['Trial', 'Starter', 'Church', 'Parish', 'Diocese']
const STATUS_NAMES = ['Trial', 'Active', 'Past Due', 'Suspended']
const STATUS_COLORS = ['#f59e0b', '#16a34a', '#dc2626', '#6b7280']

function UsageBar({ label, count, limit, pct }: { label: string; count: number; limit: number; pct: number }) {
  const unlimited = limit === -1
  const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#4f46e5'
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {count} / {unlimited ? '∞' : limit}
          {!unlimited && ` (${pct}%)`}
        </span>
      </div>
      {!unlimited && (
        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 8 }}>
          <div style={{
            width: `${Math.min(pct, 100)}%`,
            background: color,
            borderRadius: 99,
            height: 8,
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}
    </div>
  )
}

export default function SubscriptionPage() {
  const [sub, setSub]       = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')

  useEffect(() => {
    api.get<SubscriptionData>('/subscription')
      .then(r => setSub(r.data))
      .catch(() => setErr('Failed to load subscription.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="app-layout"><Header />
      <main className="container" style={{ textAlign: 'center', paddingTop: 64, color: '#6b7280' }}>Loading…</main>
    </div>
  )

  if (err || !sub) return (
    <div className="app-layout"><Header />
      <main className="container"><div className="alert alert-error">{err || 'No subscription found.'}</div></main>
    </div>
  )

  const isTrial     = sub.status === 0
  const isSuspended = sub.status === 3
  const isPastDue   = sub.status === 2

  return (
    <div className="app-layout">
      <Header />
      <main className="container">
        <div className="page-header">
          <h1 className="page-title">Subscription</h1>
        </div>

        {/* Trial banner */}
        {isTrial && sub.daysLeftInTrial <= 7 && (
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#92400e', fontWeight: 600 }}>
            ⚠️ Your trial ends in <strong>{sub.daysLeftInTrial} day{sub.daysLeftInTrial !== 1 ? 's' : ''}</strong>. Contact your system administrator to activate a plan.
          </div>
        )}
        {isSuspended && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#991b1b', fontWeight: 600 }}>
            🔒 Your account is suspended. All data is read-only. Contact support to restore access.
          </div>
        )}
        {isPastDue && (
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#9a3412', fontWeight: 600 }}>
            ⏰ Payment past due. Please contact your administrator to renew your subscription.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Plan card */}
          <div style={card}>
            <div style={cardTitle}>Current Plan</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1e1b4b', marginBottom: 4 }}>
              {PLAN_NAMES[sub.plan]}
            </div>
            <span style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: 99,
              fontSize: 12, fontWeight: 700,
              background: STATUS_COLORS[sub.status] + '22',
              color: STATUS_COLORS[sub.status],
            }}>
              {STATUS_NAMES[sub.status]}
            </span>

            {isTrial && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
                Trial ends: <strong>{new Date(sub.trialEndsAt).toLocaleDateString()}</strong>
                {' · '}<strong>{sub.daysLeftInTrial} days left</strong>
              </div>
            )}
            {sub.periodEnd && !isTrial && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
                Renews: <strong>{new Date(sub.periodEnd).toLocaleDateString()}</strong>
              </div>
            )}
          </div>

          {/* Pricing card */}
          <div style={card}>
            <div style={cardTitle}>Pricing</div>
            {sub.monthlyPrice === 0 ? (
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1e1b4b' }}>Free / Custom</div>
            ) : (
              <>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1e1b4b' }}>
                  ${sub.monthlyPrice}<span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>/mo</span>
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  or <strong>${sub.annualPrice}/yr</strong> (2 months free)
                </div>
              </>
            )}
            <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
              Billing: <strong>{sub.billingCycle === 0 ? 'Monthly' : 'Annual'}</strong>
            </div>
          </div>
        </div>

        {/* Usage */}
        <div style={card}>
          <div style={cardTitle}>Usage</div>
          <UsageBar
            label="Members (congregation)"
            count={sub.usage.memberCount}
            limit={sub.memberLimit}
            pct={sub.usage.memberPct}
          />
          <UsageBar
            label="Staff / Servants (system users)"
            count={sub.usage.servantCount}
            limit={sub.servantLimit}
            pct={sub.usage.servantPct}
          />
        </div>

        {/* Plan comparison */}
        <div style={{ ...card, marginTop: 20 }}>
          <div style={cardTitle}>Available Plans</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {['Plan', 'Members', 'Staff', 'Monthly', 'Annual'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Starter', members: 150,   servants: 5,  monthly: 19, annual: 190 },
                  { name: 'Church',  members: 500,   servants: 20, monthly: 39, annual: 390 },
                  { name: 'Parish',  members: 1500,  servants: '∞', monthly: 69, annual: 690 },
                  { name: 'Diocese', members: '∞',   servants: '∞', monthly: 'Custom', annual: 'Custom' },
                ].map(p => (
                  <tr key={p.name} style={{
                    borderBottom: '1px solid #f3f4f6',
                    background: PLAN_NAMES[sub.plan] === p.name ? '#f0f4ff' : 'transparent',
                  }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                      {p.name}
                      {PLAN_NAMES[sub.plan] === p.name && (
                        <span style={{ marginLeft: 8, fontSize: 11, background: '#4f46e5', color: '#fff', padding: '1px 6px', borderRadius: 4 }}>Current</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{p.members}</td>
                    <td style={{ padding: '10px 12px' }}>{p.servants}</td>
                    <td style={{ padding: '10px 12px' }}>{typeof p.monthly === 'number' ? `$${p.monthly}` : p.monthly}</td>
                    <td style={{ padding: '10px 12px' }}>{typeof p.annual === 'number' ? `$${p.annual}` : p.annual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12, marginBottom: 0 }}>
            To upgrade your plan, contact your ShepherdCare administrator.
          </p>
        </div>
      </main>
    </div>
  )
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: '20px 24px',
  border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}
const cardTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
}
