import React, { useState } from 'react'
import api from '../services/api'
import { useT } from '../i18n'

export default function MemberCreateForm({ familyId, onCreated }: { familyId: string, onCreated?: (m: any) => void }) {
  const { t } = useT()
  const [fullName, setFullName] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const r = await api.post('/members', { familyId, fullName })
      setFullName('')
      onCreated && onCreated(r.data)
    } catch (err) {
      alert('Failed to create member')
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <h4>{t('members.newMember')}</h4>
      <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t('members.fullName')} />
      <button type="submit">{t('common.add')}</button>
    </form>
  )
}
