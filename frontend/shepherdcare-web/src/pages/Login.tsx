import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useT } from '../i18n'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const auth = useAuth()
  const nav = useNavigate()
  const { t } = useT()

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
      <form onSubmit={submit} className="card" style={{ width: '360px' }}>
        <h2 style={{ marginBottom: 4 }}>Login</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 20 }}>رعاية — ShepherdCare</p>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder={t('login.username')}
          autoComplete="username"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={t('login.password')}
          autoComplete="current-password"
        />
        {error && <div className="error" style={{ marginTop: 6 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ marginTop: 8, width: '100%' }}>
          {loading ? t('login.signingIn') : t('login.signIn')}
        </button>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.875rem', color: '#64748b' }}>
          {t('login.newUser')} <Link to="/signup" style={{ color: '#4f46e5' }}>{t('login.createAccount')}</Link>
        </p>
      </form>
    </div>
  )
}
