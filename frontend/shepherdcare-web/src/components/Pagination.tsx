import React from 'react'
import { useT } from '../i18n'

export default function Pagination({ page, totalPages, onChange }: { page: number, totalPages: number, onChange: (p: number) => void }) {
  const { t } = useT()
  return (
    <div className="pagination">
      <button disabled={page<=1} onClick={()=>onChange(page-1)}>{t('common.prev')}</button>
      <span>{t('common.page', { n: page, total: totalPages })}</span>
      <button disabled={page>=totalPages} onClick={()=>onChange(page+1)}>{t('common.next')}</button>
    </div>
  )
}
