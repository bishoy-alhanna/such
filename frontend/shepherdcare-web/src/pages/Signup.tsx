import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useT } from '../i18n'

type Step = 'national-id' | 'credentials-only' | 'full-form'

interface CheckResult {
  found: boolean
  memberName?: string
  alreadyRegistered?: boolean
}

const EMPTY_FORM = {
  username: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  gender: '',
  dateOfBirth: '',
  mobile: '',
  fatherNationalId: '',
  isMarried: false,
  husbandNationalId: '',
}

export default function SignupPage() {
  const nav = useNavigate()
  const { t } = useT()

  const [nationalId, setNationalId] = useState('')
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkErr, setCheckErr] = useState('')

  const [step, setStep] = useState<Step>('national-id')
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [done, setDone] = useState(false)

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
      if (result.alreadyRegistered) {
        setCheckErr(t('signup.alreadyRegistered'))
        return
      }
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
        username: form.username.trim(),
        password: form.password,
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

  if (done) {
    return (
      <div className="center">
        <div className="card" style={{ width: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <h2>{t('signup.successTitle')}</h2>
          <p style={{ color: '#64748b', marginBottom: 20 }}>
            {t('signup.successMsg')}
          </p>
          <button className="btn-primary" onClick={() => nav('/login')}>{t('signup.backToLogin')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="center">
      <form onSubmit={handleSubmit} className="card" style={{ width: 420 }}>
        <h2 style={{ marginBottom: 4 }}>{t('signup.title')}</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 20 }}>
          رعاية — ShepherdCare
        </p>

        {/* ── Step 1: National ID check ── */}
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
            <button
              type="button"
              className="btn-primary"
              onClick={handleCheck}
              disabled={checking || nationalId.length !== 14}
              style={{ whiteSpace: 'nowrap' }}
            >
              {checking ? t('signup.checking') : t('signup.check')}
            </button>
          )}
          {step !== 'national-id' && (
            <button
              type="button"
              onClick={() => { setStep('national-id'); setCheckResult(null); setCheckErr('') }}
              style={{ whiteSpace: 'nowrap', padding: '6px 10px', fontSize: '0.8rem' }}
            >
              {t('signup.change')}
            </button>
          )}
        </div>

        {checkErr && <div className="error" style={{ marginTop: 6 }}>{checkErr}</div>}

        {/* Member found banner */}
        {checkResult?.found && !checkResult.alreadyRegistered && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', marginTop: 10, color: '#15803d', fontSize: '0.875rem' }}>
            {t('signup.memberFound', { name: checkResult.memberName ?? '' })}
          </div>
        )}

        {/* Member not found banner */}
        {checkResult && !checkResult.found && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginTop: 10, color: '#92400e', fontSize: '0.875rem' }}>
            {t('signup.noRecord')}
          </div>
        )}

        {/* ── Step 2: Full form (new member) ── */}
        {step === 'full-form' && (
          <>
            <label style={{ marginTop: 14 }}>{t('signup.fullName')}</label>
            <input
              value={form.fullName}
              onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
              placeholder="Full name in Arabic or English"
              autoFocus
            />

            <label>{t('signup.gender')}</label>
            <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
              <option value="">{t('signup.genderSelect')}</option>
              <option value="Male">{t('signup.male')}</option>
              <option value="Female">{t('signup.female')}</option>
            </select>

            <label>{t('signup.dob')}</label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))}
            />

            <label>{t('signup.mobile')}</label>
            <input
              value={form.mobile}
              onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))}
              placeholder="01xxxxxxxxx"
            />

            <label>{t('signup.fatherNid')}</label>
            <input
              value={form.fatherNationalId}
              onChange={e => setForm(p => ({ ...p, fatherNationalId: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
              placeholder="14-digit ID (used to find your family)"
              maxLength={14}
            />
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 10px' }}>
              {t('signup.fatherNidHint')}
            </p>

            {/* ── Married female: extra fields ── */}
            {form.gender === 'Female' && (
              <>
                <label style={{ marginTop: 4 }}>{t('signup.maritalStatus')}</label>
                <select
                  value={form.isMarried ? 'married' : 'single'}
                  onChange={e => setForm(p => ({ ...p, isMarried: e.target.value === 'married', husbandNationalId: '' }))}
                >
                  <option value="single">{t('signup.single')}</option>
                  <option value="married">{t('signup.married')}</option>
                </select>

                {form.isMarried && (
                  <>
                    <label style={{ marginTop: 8 }}>{t('signup.husbandNid')}</label>
                    <input
                      value={form.husbandNationalId}
                      onChange={e => setForm(p => ({ ...p, husbandNationalId: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
                      placeholder="14-digit ID of your husband"
                      maxLength={14}
                    />
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 10px' }}>
                      {t('signup.husbandNidHint')}
                    </p>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── Credentials (both steps) ── */}
        {(step === 'credentials-only' || step === 'full-form') && (
          <>
            <label style={{ marginTop: step === 'full-form' ? 0 : 14 }}>{t('signup.username')}</label>
            <input
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              placeholder="Choose a username"
              autoFocus={step === 'credentials-only'}
              autoComplete="username"
            />

            <label>{t('signup.password')}</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="Choose a password"
              autoComplete="new-password"
            />

            <label>{t('signup.confirmPassword')}</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
              placeholder="Repeat your password"
              autoComplete="new-password"
            />

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
