import React, { useState } from 'react'
import api from '../services/api'
import { mapValidationErrors } from '../utils/validation'
import { useT } from '../i18n'

export default function VisitForm({ onCreated }: { onCreated?: (v: any) => void }) {
  const { t } = useT()
  const [familyId, setFamilyId] = useState('')
  const [performedById, setPerformedById] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [visitType, setVisitType] = useState('')
  const [outcome, setOutcome] = useState('')
  const [errors, setErrors] = useState<Record<string,string[]>>({})

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const r = await api.post('/visits', { familyId, performedById, visitDate, visitType, outcome })
      setFamilyId('')
      setPerformedById('')
      setVisitDate('')
      setVisitType('')
      setOutcome('')
      setErrors({})
      onCreated && onCreated(r.data)
    } catch (err:any) {
      setErrors(mapValidationErrors(err))
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <h3>{t('visits.form.title')}</h3>
      <input value={familyId} onChange={e => setFamilyId(e.target.value)} placeholder={t('visits.form.familyId')} />
      {errors.familyId && <div className="error">{errors.familyId.join(', ')}</div>}
      <input value={performedById} onChange={e => setPerformedById(e.target.value)} placeholder={t('visits.form.performedBy')} />
      {errors.performedById && <div className="error">{errors.performedById.join(', ')}</div>}
      <input value={visitDate} onChange={e => setVisitDate(e.target.value)} placeholder={t('visits.form.date')} />
      {errors.visitDate && <div className="error">{errors.visitDate.join(', ')}</div>}
      <input value={visitType} onChange={e => setVisitType(e.target.value)} placeholder={t('visits.form.type')} />
      {errors.visitType && <div className="error">{errors.visitType.join(', ')}</div>}
      <input value={outcome} onChange={e => setOutcome(e.target.value)} placeholder={t('visits.form.outcome')} />
      {errors.outcome && <div className="error">{errors.outcome.join(', ')}</div>}
      <button type="submit">{t('common.create')}</button>
    </form>
  )
}
