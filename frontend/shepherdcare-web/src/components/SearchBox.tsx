import React from 'react'
import { useT } from '../i18n'

export default function SearchBox({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const { t } = useT()
  return (
    <input placeholder={t('common.search')} value={value} onChange={e => onChange(e.target.value)} />
  )
}
