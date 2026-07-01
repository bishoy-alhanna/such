import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../auth'

interface SubStatus { status: number; daysLeftInTrial: number; plan: number }

export default function SubscriptionBanner() {
  const { hasRole } = useAuth()
  const navigate    = useNavigate()
  const [info, setInfo] = useState<SubStatus | null>(null)

  useEffect(() => {
    if (hasRole('SystemAdmin')) return
    api.get<SubStatus>('/subscription')
      .then(r => setInfo(r.data))
      .catch(() => {})
  }, [])

  if (!info) return null

  // Trial ending soon (≤ 7 days)
  if (info.status === 0 && info.daysLeftInTrial <= 7) {
    return (
      <div style={banner('#fef3c7', '#92400e', '#fcd34d')}>
        ⚠️ Trial expires in <strong>{info.daysLeftInTrial} day{info.daysLeftInTrial !== 1 ? 's' : ''}</strong>.
        <button style={link} onClick={() => navigate('/subscription')}>View plans →</button>
      </div>
    )
  }

  // Suspended
  if (info.status === 3) {
    return (
      <div style={banner('#fee2e2', '#991b1b', '#fca5a5')}>
        🔒 Account suspended — read-only mode. Contact your administrator.
        <button style={link} onClick={() => navigate('/subscription')}>Details →</button>
      </div>
    )
  }

  // Past due
  if (info.status === 2) {
    return (
      <div style={banner('#fff7ed', '#9a3412', '#fdba74')}>
        ⏰ Payment past due. Contact your administrator to renew.
        <button style={link} onClick={() => navigate('/subscription')}>Details →</button>
      </div>
    )
  }

  return null
}

const banner = (bg: string, color: string, border: string) => ({
  background: bg, color, borderBottom: `2px solid ${border}`,
  padding: '10px 24px', fontSize: 13, fontWeight: 600,
  display: 'flex', alignItems: 'center', gap: 12,
})
const link: React.CSSProperties = {
  background: 'none', border: 'none', color: 'inherit',
  textDecoration: 'underline', cursor: 'pointer', fontWeight: 700, fontSize: 13,
}
