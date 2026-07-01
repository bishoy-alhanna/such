import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

export const API_BASE_URL    = 'https://sgch.al-hanna.com/api'
export const SERVER_BASE_URL = 'https://sgch.al-hanna.com'

const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 })

api.interceptors.request.use(async config => {
  const token = await SecureStore.getItemAsync('jwt_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('jwt_token')
    }
    return Promise.reject(err)
  }
)

export default api
