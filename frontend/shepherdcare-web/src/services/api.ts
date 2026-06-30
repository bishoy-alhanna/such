import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

// Set JSON as default for non-FormData requests
api.defaults.headers.common['Content-Type'] = 'application/json'

// Before each request: if body is FormData, remove the Content-Type header so
// the browser sets it automatically with the correct multipart boundary.
api.interceptors.request.use(config => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// If any response comes back 401 (expired / invalid token) clear storage
// and redirect to login so the user isn't stuck in a broken state.
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      const hadToken = !!localStorage.getItem('token')
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
      // Only redirect if we actually had a token (avoid redirect loop on /login)
      if (hadToken && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
