import React, { useState } from 'react'
import api from '../services/api'
import { useT } from '../i18n'

export default function PriestNoteCreateForm({ familyId, memberId, onCreated }: { familyId?: string, memberId?: string, onCreated?: (n: any) => void }) {
  const { t } = useT()
  const [content, setContent] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: any = { content }
      if (familyId) payload.familyId = familyId
      if (memberId) payload.memberId = memberId
      const r = await api.post('/priestnotes', payload)
      setContent('')
      onCreated && onCreated(r.data)
    } catch (err) {
      alert('Failed to create note')
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <h4>{t('priestNote.new')}</h4>
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={t('spiritual.notes')} />
      <button type="submit">{t('common.save')}</button>
    </form>
  )
}
