import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { Alert } from 'react-native'

const FALLBACK = 'https://sgch.al-hanna.com'

export function getServerBaseUrl(): string {
  return api.defaults.baseURL?.replace(/\/api$/, '') ?? FALLBACK
}

export function setChurchBaseUrl(baseUrl: string) {
  api.defaults.baseURL = `${baseUrl}/api`
}

const api = axios.create({ baseURL: `${FALLBACK}/api`, timeout: 15000 })

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
    if (err.response?.status === 403) {
      const msg: string = err.response?.data?.message ?? ''
      if (msg.toLowerCase().includes('subscription')) {
        Alert.alert(
          'اشتراك موقوف',
          'اشتراك كنيستك موقوف أو منتهي. يرجى التواصل مع مسؤول الكنيسة.',
          [{ text: 'حسناً' }]
        )
      }
    }
    return Promise.reject(err)
  }
)

// Re-export for files that used the old named exports
export const SERVER_BASE_URL = FALLBACK
export const API_BASE_URL    = `${FALLBACK}/api`

export default api
