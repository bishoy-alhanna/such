export function mapValidationErrors(err: any) {
  try {
    const data = err.response?.data
    if (data && data.errors) return data.errors
  } catch {}
  return {}
}
