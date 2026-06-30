import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../services/api'
import Header from '../components/Header'

export default function ProfilePage() {
  const [memberId, setMemberId] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [noLink, setNoLink]     = useState(false)

  useEffect(() => {
    api.get<{ id: string }>('/members/profile')
      .then(r => setMemberId(r.data.id))
      .catch(e => { if (e?.response?.status === 404) setNoLink(true) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div>
      <Header />
      <div className="container" style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
        جارٍ التحميل…
      </div>
    </div>
  )

  if (memberId) return <Navigate to={`/members/${memberId}`} replace />

  return (
    <div>
      <Header />
      <div className="container">
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
          <h3 style={{ marginBottom: 8 }}>لم يتم ربط الحساب بملف عضو</h3>
          <p style={{ color: '#6b7280', margin: 0 }}>
            تواصل مع المسؤول لربط حسابك بملفك الشخصي في قاعدة البيانات.
          </p>
        </div>
      </div>
    </div>
  )
}
