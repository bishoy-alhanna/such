import { useState, useMemo } from 'react'

export type SortDir = 'asc' | 'desc'

export function useSortableData<T extends Record<string, any>>(
  data: T[],
  defaultKey: keyof T | null = null,
  defaultDir: SortDir = 'asc'
) {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp =
        typeof av === 'string' && typeof bv === 'string'
          ? av.localeCompare(bv, undefined, { sensitivity: 'base' })
          : av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  const requestSort = (key: string) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key as keyof T); setSortDir('asc') }
  }

  return { sorted, sortKey: sortKey as string | null, sortDir, requestSort }
}
