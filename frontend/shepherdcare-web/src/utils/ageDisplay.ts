function calcAge(dob: Date, ref: Date): string {
  let years = ref.getFullYear() - dob.getFullYear()
  let months = ref.getMonth() - dob.getMonth()
  if (ref.getDate() < dob.getDate()) months--
  if (months < 0) { years--; months += 12 }
  if (years < 0) return '—'
  if (years === 0 && months === 0) return '< 1m'
  if (years === 0) return `${months}m`
  if (months === 0) return `${years}y`
  return `${years}y ${months}m`
}

function sep15RefDate(): Date {
  const today = new Date()
  const year = (today.getMonth() < 8 || (today.getMonth() === 8 && today.getDate() < 15))
    ? today.getFullYear() - 1
    : today.getFullYear()
  return new Date(year, 8, 15)
}

export function sep15RefYear(): number {
  return sep15RefDate().getFullYear()
}

/** Age calculated from DOB to today */
export function formatAge(dob: string | undefined | null): string {
  if (!dob) return '—'
  return calcAge(new Date(dob), new Date())
}

/** Age calculated from DOB to most recent past Sep 15 (service/academic year age) */
export function formatServiceAge(dob: string | undefined | null): string {
  if (!dob) return '—'
  return calcAge(new Date(dob), sep15RefDate())
}
