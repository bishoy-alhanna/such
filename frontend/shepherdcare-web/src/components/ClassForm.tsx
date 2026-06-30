import React, { useState } from 'react'
import api from '../services/api'
import { mapValidationErrors } from '../utils/validation'
import { useT } from '../i18n'

export default function ClassForm({ onCreated }: { onCreated?: (c: any) => void }) {
  const { t } = useT()
  const [className, setClassName] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [errors, setErrors] = useState<Record<string,string[]>>({})

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const r = await api.post('/classes', { className, ageGroup, serviceId })
      setClassName('')
      setAgeGroup('')
      setServiceId('')
      setErrors({})
      onCreated && onCreated(r.data)
    } catch (err:any) {
      setErrors(mapValidationErrors(err))
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <h3>{t('classes.form.title')}</h3>
      <input value={className} onChange={e => setClassName(e.target.value)} placeholder={t('classes.form.className')} />
      {errors.className && <div className="error">{errors.className.join(', ')}</div>}
      <input value={ageGroup} onChange={e => setAgeGroup(e.target.value)} placeholder={t('classes.form.ageGroup')} />
      {errors.ageGroup && <div className="error">{errors.ageGroup.join(', ')}</div>}
      <input value={serviceId} onChange={e => setServiceId(e.target.value)} placeholder={t('classes.form.serviceId')} />
      {errors.serviceId && <div className="error">{errors.serviceId.join(', ')}</div>}
      <button type="submit">{t('common.create')}</button>
    </form>
  )
}
