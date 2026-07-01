import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { applyChurchSlug } from '../auth'
import { useT } from '../i18n'

type Step = 'church' | 'national-id' | 'credentials-only' | 'full-form'

interface Church { id: string; name: string; slug: string }
interface CheckResult { found: boolean; memberName?: string; alreadyRegistered?: boolean }

const EMPTY_FORM = {
  username: '', password: '', confirmPassword: '',
  fullName: '', gender: '', dateOfBirth: '', mobile: '',
  fatherNationalId: '', isMarried: false, husbandNationalId: '',
}

export default function SignupPage() {
  const nav     = useNavigate()
  const { t }   = useT()

  // ── Step 0: church ──────────────────────────────────────────────
  const [churches,     setChurches]     = useState<Church[]>([])
  const [churchSearch, setChurchSearch] = useState('')
  const [selectedChurch, setSelectedChurch] = useState<Church | null>(null)
  const [churchesErr,  setChurchesErr]  = useState('')

  useEffect(() => {
    api.get<Church[]>('/churches/public')
      .then(r => setChurches(r.data))
      .catch(() => setChurchesErr('Could not load church list. Please try again.'))
  }, [])

  const filteredChurches = churches.filter(c =>
    c.name.toLowerCase().includes(churchSearch.toLowerCase())
  )

  const selectChurch = (c: Church) => {
    setSelectedChurch(c)
    applyChurchSlug(c.slug)
    setStep('national-id')
  }

  // ── Step 1+: national-id / form ─────────────────────────────────
  const [nationalId,   setNationalId]   = useState('')
  const [checkResult,  setCheckResult]  = useState<CheckResult | null>(null)
  const [checking,     setChecking]     = useState(false)
  const [checkErr,     setCheckErr]     = useState('')
  const [step,         setStep]         = useState<Step>('church')
  const [form,         setForm]         = useState({ ...EMPTY_FORM })
  const [submitting,   setSubmitting]   = useState(false)
  const [submitErr,    setSubmitErr]    = useState('')
  const [done,         setDone]         = useState(false)

  const resetToChurch = () => {
    setStep('church')
    setSelectedChurch(null)
    applyChurchSlug(null)
    setNationalId('')
    setCheckResult(null)
    setCheckErr('')
    setForm({ ...EMPTY_FORM })
    setSubmitErr('')
  }

  const handleCheck = async () => {
    setCheckErr('')
    setCheckResult(null)
    if (nationalId.length !== 14 || !/^\d{14}$/.test(nationalId)) {
      setCheckErr('National ID must be exactly 14 digits.')
      return
    }
    setChecking(true)
    try {
      const r = await api.get<CheckResult>('/auth/check-national-id', { params: { nationalId } })
      const result = r.data
      setCheckResult(result)
      if (result.alreadyRegistered) { setCheckErr(t('signup.alreadyRegistered')); return }
      setStep(result.found ? 'credentials-only' : 'full-form')
    } catch {
      setCheckErr('Failed to check National ID. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitErr('')
    if (!form.username.trim()) return setSubmitErr('Username is required.')
    if (!form.password)         return setSubmitErr('Password is required.')
    if (form.password !== form.confirmPassword) return setSubmitErr('Passwords do not match.')
    if (step === 'full-form' && !form.fullName.trim()) return setSubmitErr('Full name is required.')
    setSubmitting(true)
    try {
      const isMarriedFemale = step === 'full-form' && form.gender === 'Female' && form.isMarried
      await api.post('/auth/signup', {
        username:          form.username.trim(),
        password:          form.password,
        nationalId,
        fullName:          step === 'full-form' ? form.fullName.trim() : undefined,
        gender:            step === 'full-form' ? form.gender || undefined : undefined,
        dateOfBirth:       step === 'full-form' && form.dateOfBirth ? form.dateOfBirth : undefined,
        mobile:            step === 'full-form' ? form.mobile || undefined : undefined,
        fatherNationalId:  step === 'full-form' ? form.fatherNationalId || undefined : undefined,
        isMarried:         isMarriedFemale,
        husbandNationalId: isMarriedFemale ? form.husbandNationalId || undefined : undefined,
      })
      setDone(true)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setSubmitErr(e?.response?.data?.message ?? 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Done ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="center">
        <div className="card" style={{ width: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <h2>{t('signup.successTitle')}</h2>
          <p style={{ color: '#64748b', marginBottom: 20 }}>{t('signup.successMsg')}</p>
          <button className="btn-primary" onClick={() => nav('/login')}>{t('signup.backToLogin')}</button>
        </div>
      </div>
    )
  }

  // ── Step 0: pick church ───────────────────────────────────────────
  if (step === 'church') {
    return (
      <div className="center">
        <div className="card" style={{ width: 460 }}>
          <h2 style={{ marginBottom: 4 }}>Select Your Church</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 20 }}>رعاية — ShepherdCare</p>

          {churchesErr && <div className="error" style={{ marginBottom: 12 }}>{churchesErr}</div>}

          {churches.length > 4 && (
            <input
              value={churchSearch}
              onChange={e => setChurchSearch(e.target.value)}
              placeholder="Search churches..."
              style={{ marginBottom: 12 }}
              autoFocus
            />
          )}

          {churches.length === 0 && !churchesErr && (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>Loading churches…</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
            {filteredChurches.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectChurch(c)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10,
                  border: '1.5px solid #e2e8f0', background: '#fff',
                  cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
              >
                <span style={{ fontSize: 22 }}>⛪</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{c.name}</span>
              </button>
            ))}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '20px 0 16px' }} />
          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#64748b' }}>
            Already have an account? <Link to="/login" style={{ color: '#4f46e5' }}>Sign in</Link>
          </p>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af', marginTop: 8 }}>
            New church? <Link to="/register-church" style={{ color: '#4f46e5' }}>Register your church</Link>
          </p>
        </div>
      </div>
    )
  }

  // ── Steps 1–3: national-id / form / credentials ───────────────────
  return (
    <div className="center">
      <form onSubmit={handleSubmit} className="card" style={{ width: 420 }}>
        {/* Church badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
          background: '#f1f5f9', borderRadius: 8, padding: '8px 12px' }}>
          <span style={{ fontSize: '0.85rem', color: '#475569' }}>
            ⛪ <strong>{selectedChurch?.name}</strong>
          </span>
          <button type="button" onClick={resetToChurch}
            style={{ fontSize: '0.75rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Change
          </button>
        </div>

        <h2 style={{ marginBottom: 4 }}>{t('signup.title')}</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 20 }}>رعاية — ShepherdCare</p>

        {/* National ID */}
        <label>{t('signup.nationalId')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={nationalId}
            onChange={e => { setNationalId(e.target.value.replace(/\D/g, '').slice(0, 14)); setCheckResult(null); setStep('national-id') }}
            placeholder="12345678901234"
            maxLength={14}
            style={{ flex: 1 }}
            disabled={step !== 'national-id' && !!checkResult}
          />
          {step === 'national-id' && (
            <button type="button" className="btn-primary" onClick={handleCheck}
              disabled={checking || nationalId.length !== 14} style={{ whiteSpace: 'nowrap' }}>
              {checking ? t('signup.checking') : t('signup.check')}
            </button>
          )}
          {step !== 'national-id' && (
            <button type="button"
              onClick={() => { setStep('national-id'); setCheckResult(null); setCheckErr('') }}
              style={{ whiteSpace: 'nowrap', padding: '6px 10px', fontSize: '0.8rem' }}>
              {t('signup.change')}
            </button>
          )}
        </div>
        {checkErr && <div className="error" style={{ marginTop: 6 }}>{checkErr}</div>}

        {checkResult?.found && !checkResult.alreadyRegistered && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', marginTop: 10, color: '#15803d', fontSize: '0.875rem' }}>
            {t('signup.memberFound', { name: checkResult.memberName ?? '' })}
          </div>
        )}
        {checkResult && !checkResult.found && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginTop: 10, color: '#92400e', fontSize: '0.875rem' }}>
            {t('signup.noRecord')}
          </div>
        )}

        {/* Full form for new members */}
        {step === 'full-form' && (
          <>
            <label style={{ marginTop: 14 }}>{t('signup.fullName')}</label>
            <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
              placeholder="Full name in Arabic or English" autoFocus />

            <label>{t('signup.gender')}</label>
            <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
              <option value="">{t('signup.genderSelect')}</option>
              <option value="Male">{t('signup.male')}</option>
              <option value="Female">{t('signup.female')}</option>
            </select>

            <label>{t('signup.dob')}</label>
            <input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} />

            <label>{t('signup.mobile')}</label>
            <input value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} placeholder="01xxxxxxxxx" />

            <label>{t('signup.fatherNid')}</label>
            <input value={form.fatherNationalId}
              onChange={e => setForm(p => ({ ...p, fatherNationalId: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
              placeholder="14-digit ID (used to find your family)" maxLength={14} />
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 10px' }}>{t('signup.fatherNidHint')}</p>

            {form.gender === 'Female' && (
              <>
                <label style={{ marginTop: 4 }}>{t('signup.maritalStatus')}</label>
                <select value={form.isMarried ? 'married' : 'single'}
                  onChange={e => setForm(p => ({ ...p, isMarried: e.target.value === 'married', husbandNationalId: '' }))}>
                  <option value="single">{t('signup.single')}</option>
                  <option value="married">{t('signup.married')}</option>
                </select>
                {form.isMarried && (
                  <>
                    <label style={{ marginTop: 8 }}>{t('signup.husbandNid')}</label>
                    <input value={form.husbandNationalId}
                      onChange={e => setForm(p => ({ ...p, husbandNationalId: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
                      placeholder="14-digit ID of your husband" maxLength={14} />
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 10px' }}>{t('signup.husbandNidHint')}</p>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Credentials */}
        {(step === 'credentials-only' || step === 'full-form') && (
          <>
            <label style={{ marginTop: step === 'full-form' ? 0 : 14 }}>{t('signup.username')}</label>
            <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              placeholder="Choose a username" autoFocus={step === 'credentials-only'} autoComplete="username" />

            <label>{t('signup.password')}</label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="Choose a password" autoComplete="new-password" />

            <label>{t('signup.confirmPassword')}</label>
            <input type="password" value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
              placeholder="Repeat your password" autoComplete="new-password" />

            {submitErr && <div className="error" style={{ marginTop: 8 }}>{submitErr}</div>}
            <button type="submit" className="btn-primary" disabled={submitting} style={{ marginTop: 14, width: '100%' }}>
              {submitting ? t('signup.submitting') : t('signup.submit')}
            </button>
          </>
        )}

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.875rem', color: '#64748b' }}>
          {t('signup.hasAccount')} <Link to="/login" style={{ color: '#4f46e5' }}>{t('signup.signIn')}</Link>
        </p>
      </form>
    </div>
  )
}
