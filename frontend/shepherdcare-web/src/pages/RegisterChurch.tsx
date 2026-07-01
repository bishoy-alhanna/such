import React, { useState } from 'react'
import api from '../services/api'

interface RegisteredChurch {
  id: string
  name: string
  slug: string
  city?: string
  country?: string
  isActive: boolean
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export default function RegisterChurchPage() {
  const [name, setName]               = useState('')
  const [slug, setSlug]               = useState('')
  const [email, setEmail]             = useState('')
  const [city, setCity]               = useState('')
  const [country, setCountry]         = useState('')
  const [slugManual, setSlugManual]   = useState(false)
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminDisplay, setAdminDisplay]   = useState('')
  const [saving, setSaving]           = useState(false)
  const [err, setErr]                 = useState('')
  const [done, setDone]               = useState<RegisteredChurch | null>(null)

  const handleNameChange = (v: string) => {
    setName(v)
    if (!slugManual) setSlug(slugify(v))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) { setErr('Church name and slug are required.'); return }
    if (!adminUsername.trim() || !adminPassword.trim()) { setErr('Admin username and password are required.'); return }
    if (adminPassword.length < 8) { setErr('Admin password must be at least 8 characters.'); return }
    setSaving(true)
    setErr('')
    try {
      const res = await api.post<RegisteredChurch>('/churches/register', {
        name: name.trim(),
        slug: slug.trim(),
        contactEmail: email || null,
        city: city || null,
        country: country || null,
        adminUsername: adminUsername.trim(),
        adminPassword,
        adminDisplayName: adminDisplay.trim() || null,
      })
      setDone(res.data)
    } catch (e: any) {
      const msg = e?.response?.data?.title || e?.response?.data || 'Registration failed.'
      setErr(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    const churchUrl = `https://${done.slug}.sgch.al-hanna.com`
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✅</div>
          <h2 style={styles.title}>Registration Submitted</h2>
          <p style={styles.subtitle}>
            Your church <strong>{done.name}</strong> has been registered and is awaiting approval by a platform administrator.
          </p>
          <div style={styles.urlBox}>
            <div style={styles.urlLabel}>Your church URL will be:</div>
            <code style={styles.url}>{churchUrl}</code>
          </div>
          <div style={styles.urlBox}>
            <div style={styles.urlLabel}>Mobile app slug:</div>
            <code style={styles.url}>{done.slug}</code>
          </div>
          <div style={styles.urlBox}>
            <div style={styles.urlLabel}>Your admin login (active after approval):</div>
            <code style={styles.url}>{adminUsername}</code>
          </div>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 12 }}>
            Once approved, members can enter <strong>{done.slug}</strong> in the mobile app or scan the QR code below.
          </p>

          {/* Simple QR via public API — no dependency needed */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(churchUrl)}`}
            alt="Church QR Code"
            style={{ display: 'block', margin: '16px auto', borderRadius: 8 }}
          />

          <a href="/login" style={styles.btn}>Go to Login →</a>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✝</div>
          <h1 style={styles.title}>Register Your Church</h1>
          <p style={styles.subtitle}>
            Set up ShepherdCare for your congregation. After submitting, a platform admin will review and activate your church.
          </p>
        </div>

        {err && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
            {err}
          </div>
        )}

        <form onSubmit={submit}>
          <label style={styles.label}>Church Name *</label>
          <input
            style={styles.input}
            placeholder="St. Mark Coptic Orthodox Church"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            required
          />

          <label style={styles.label}>URL Slug * <span style={{ color: '#9ca3af', fontWeight: 400 }}>(letters, numbers, hyphens only)</span></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ color: '#6b7280', fontSize: 13, whiteSpace: 'nowrap' }}>https://</span>
            <input
              style={{ ...styles.input, marginBottom: 0, flex: 1 }}
              placeholder="stmark"
              value={slug}
              onChange={e => { setSlug(slugify(e.target.value)); setSlugManual(true) }}
              required
            />
            <span style={{ color: '#6b7280', fontSize: 13, whiteSpace: 'nowrap' }}>.sgch.al-hanna.com</span>
          </div>

          <label style={styles.label}>Contact Email</label>
          <input
            type="email"
            style={styles.input}
            placeholder="admin@stmark.org"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={styles.label}>City</label>
              <input style={styles.input} placeholder="Cairo" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div>
              <label style={styles.label}>Country</label>
              <input style={styles.input} placeholder="Egypt" value={country} onChange={e => setCountry(e.target.value)} />
            </div>
          </div>

          {/* Admin account */}
          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0 16px' }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
            Church Admin Account
            <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
              — activated automatically when your church is approved
            </span>
          </p>

          <label style={styles.label}>Display Name</label>
          <input
            style={styles.input}
            placeholder="Father Bishoy"
            value={adminDisplay}
            onChange={e => setAdminDisplay(e.target.value)}
          />

          <label style={styles.label}>Admin Username *</label>
          <input
            style={styles.input}
            placeholder="stmark.admin"
            value={adminUsername}
            onChange={e => setAdminUsername(e.target.value)}
            autoComplete="off"
            required
          />

          <label style={styles.label}>Admin Password * <span style={{ fontWeight: 400, color: '#9ca3af' }}>(min 8 chars)</span></label>
          <input
            type="password"
            style={styles.input}
            placeholder="••••••••"
            value={adminPassword}
            onChange={e => setAdminPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <button type="submit" disabled={saving} style={styles.btn}>
            {saving ? 'Submitting…' : 'Register Church'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6b7280' }}>
            Already registered? <a href="/login" style={{ color: '#4f46e5' }}>Sign in</a>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0d1a4e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 520,
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
  },
  title: { margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#1e1b4b', textAlign: 'center' as const },
  subtitle: { color: '#6b7280', fontSize: 14, textAlign: 'center' as const, marginTop: 8 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 },
  input: {
    display: 'block', width: '100%', border: '1px solid #d1d5db',
    borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#111827',
    marginBottom: 16, boxSizing: 'border-box' as const, outline: 'none',
  },
  btn: {
    display: 'block', width: '100%', background: '#4f46e5', color: '#fff',
    border: 'none', borderRadius: 10, padding: '13px', fontSize: 15,
    fontWeight: 700, cursor: 'pointer', textAlign: 'center' as const,
    marginTop: 8, textDecoration: 'none',
  },
  urlBox: {
    background: '#f3f4f6', borderRadius: 8, padding: '10px 14px', marginBottom: 12,
  },
  urlLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase' as const, marginBottom: 4, fontWeight: 600 },
  url: { fontSize: 14, color: '#4f46e5', fontWeight: 600 },
  successIcon: { fontSize: 40, textAlign: 'center' as const, marginBottom: 12 },
}
