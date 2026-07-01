import React, { createContext, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import api from '../services/api'

interface AuthUser { id: string; username: string; displayName?: string; role: string }
interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync('auth_user')
        if (raw) setUser(JSON.parse(raw))
      } catch {}
      setLoading(false)
    })()
  }, [])

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password })
    const { token, user: u } = res.data
    await SecureStore.setItemAsync('jwt_token', token)
    await SecureStore.setItemAsync('auth_user', JSON.stringify(u))
    setUser(u)
  }

  const logout = async () => {
    await SecureStore.deleteItemAsync('jwt_token')
    await SecureStore.deleteItemAsync('auth_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
