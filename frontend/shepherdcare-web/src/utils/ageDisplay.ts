export function formatAge(dob: string | undefined | null): string {
  if (!dob) return '—'
  const birth = new Date(dob)
  const now = new Date()

  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()

  if (now.getDate() < birth.getDate()) months--
  if (months < 0) { years--; months += 12 }
  if (years < 0) return '—'

  if (years === 0 && months === 0) return '< 1m'
  if (years === 0) return `${months}m`
  if (months === 0) return `${years}y`
  return `${years}y ${months}m`
}
