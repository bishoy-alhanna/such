import React, { createContext, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import api from '../services/api'

interface AuthUser {
  id: string
  username: string
  displayName?: string
  role: string
  churchSlug?: string
}

interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx)
export const useAuth = () => useContext(AuthContext)

function applyChurchSlug(slug: string | null | undefined) {
  if (slug) {
    api.defaults.headers.common['X-Church-Slug'] = slug
  } else {
    delete api.defaults.headers.common['X-Church-Slug']
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const raw  = await SecureStore.getItemAsync('auth_user')
        const slug = await SecureStore.getItemAsync('church_slug')
        if (raw) {
          const parsed: AuthUser = JSON.parse(raw)
          applyChurchSlug(slug ?? parsed.churchSlug)
          setUser({ ...parsed, churchSlug: slug ?? parsed.churchSlug ?? undefined })
        }
      } catch {}
      setLoading(false)
    })()
  }, [])

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password })
    const { token, user: u } = res.data
    const slug: string | undefined = u?.churchSlug

    await SecureStore.setItemAsync('jwt_token', token)
    await SecureStore.setItemAsync('auth_user', JSON.stringify(u))
    if (slug) {
      await SecureStore.setItemAsync('church_slug', slug)
    } else {
      await SecureStore.deleteItemAsync('church_slug')
    }

    applyChurchSlug(slug)
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setUser(u)
  }

  const logout = async () => {
    await SecureStore.deleteItemAsync('jwt_token')
    await SecureStore.deleteItemAsync('auth_user')
    await SecureStore.deleteItemAsync('church_slug')
    applyChurchSlug(null)
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
