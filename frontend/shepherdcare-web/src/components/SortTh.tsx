import type { CSSProperties } from 'react'
import type { SortDir } from '../hooks/useSortableData'

interface Props {
  label: string
  field: string
  current: string | null
  dir: SortDir
  onSort: (f: string) => void
  style?: CSSProperties
}

export default function SortTh({ label, field, current, dir, onSort, style }: Props) {
  const active = current === field
  return (
    <th
      onClick={() => onSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
    >
      {label}
      <span style={{ marginLeft: 4, fontSize: 10, opacity: active ? 1 : 0.35 }}>
        {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  )
}
