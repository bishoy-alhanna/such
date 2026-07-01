import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, applyChurchSlug } from '../auth'
import { useT } from '../i18n'
import api from '../services/api'

interface Church { id: string; name: string; slug: string }

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const auth   = useAuth()
  const nav    = useNavigate()
  const { t }  = useT()

  // Church selection (optional on login — slug is returned in login response)
  const [churches,       setChurches]       = useState<Church[]>([])
  const [selectedChurch, setSelectedChurch] = useState<Church | null>(null)
  const [showPicker,     setShowPicker]     = useState(false)
  const [churchSearch,   setChurchSearch]   = useState('')

  // Restore selected church from localStorage if any
  useEffect(() => {
    const storedSlug = localStorage.getItem('churchSlug')
    api.get<Church[]>('/churches/public').then(r => {
      setChurches(r.data)
      if (storedSlug) {
        const match = r.data.find(c => c.slug === storedSlug)
        if (match) setSelectedChurch(match)
      }
    }).catch(() => {})
  }, [])

  const pickChurch = (c: Church) => {
    setSelectedChurch(c)
    applyChurchSlug(c.slug)
    setShowPicker(false)
    setChurchSearch('')
  }

  const clearChurch = () => {
    setSelectedChurch(null)
    applyChurchSlug(null)
  }

  const filtered = churches.filter(c =>
    c.name.toLowerCase().includes(churchSearch.toLowerCase())
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await auth.login(username, password)
      nav('/')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="center">
      <form onSubmit={submit} className="card" style={{ width: '380px' }}>
        <h2 style={{ marginBottom: 4 }}>Login</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 20 }}>رعاية — ShepherdCare</p>

        {/* Church indicator / picker trigger */}
        {!showPicker && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10,
            background: selectedChurch ? '#f1f5f9' : '#fafafa',
            border: `1.5px solid ${selectedChurch ? '#c7d2fe' : '#e2e8f0'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {selectedChurch ? (
              <>
                <span style={{ fontSize: '0.875rem', color: '#1e293b' }}>
                  ⛪ <strong>{selectedChurch.name}</strong>
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => { setShowPicker(true); setChurchSearch('') }}
                    style={{ fontSize: '0.75rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Change
                  </button>
                  <button type="button" onClick={clearChurch}
                    style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    ✕
                  </button>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>⛪ Select your church (optional)</span>
                <button type="button" onClick={() => setShowPicker(true)}
                  style={{ fontSize: '0.75rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Browse
                </button>
              </>
            )}
          </div>
        )}

        {/* Church dropdown */}
        {showPicker && (
          <div style={{ marginBottom: 16, border: '1.5px solid #c7d2fe', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <input value={churchSearch} onChange={e => setChurchSearch(e.target.value)}
                placeholder="Search churches..." autoFocus style={{ margin: 0 }} />
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {filtered.map(c => (
                <button key={c.id} type="button" onClick={() => pickChurch(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 14px', border: 'none', borderBottom: '1px solid #f1f5f9',
                    background: '#fff', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                  <span>⛪</span>
                  <span style={{ fontWeight: 500, color: '#1e293b', fontSize: '0.9rem' }}>{c.name}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p style={{ padding: '12px 14px', color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>No churches found</p>
              )}
            </div>
            <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button type="button" onClick={() => setShowPicker(false)}
                style={{ fontSize: '0.8rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <input value={username} onChange={e => setUsername(e.target.value)}
          placeholder={t('login.username')} autoComplete="username" autoFocus={!showPicker} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder={t('login.password')} autoComplete="current-password" />

        {error && <div className="error" style={{ marginTop: 6 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ marginTop: 8, width: '100%' }}>
          {loading ? t('login.signingIn') : t('login.signIn')}
        </button>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.875rem', color: '#64748b' }}>
          {t('login.newUser')} <Link to="/signup" style={{ color: '#4f46e5' }}>{t('login.createAccount')}</Link>
        </p>
        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />
        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>
          Are you a church administrator?{' '}
          <Link to="/register-church" style={{ color: '#4f46e5' }}>Register your church</Link>
        </p>
      </form>
    </div>
  )
}
