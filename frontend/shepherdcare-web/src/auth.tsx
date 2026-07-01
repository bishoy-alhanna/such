import React, { createContext, useContext, useState } from 'react'
import api from './services/api'

type UserInfo = {
  id?: string
  username: string
  displayName?: string
  role?: string
  familyMemberId?: string
  churchSlug?: string
}

type AuthContextType = {
  token: string | null
  user: UserInfo | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** Decode a JWT payload into UserInfo. Returns null on any error. */
function decodeToken(t: string, churchSlug?: string): UserInfo | null {
  try {
    const payload = JSON.parse(atob(t.split('.')[1]))
    return {
      id:          payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
                   || payload.sub,
      username:    payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
                   || payload.unique_name || payload.name || '',
      displayName: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
                   || payload.name,
      role:           payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
                      || payload.role,
      familyMemberId: payload['familyMemberId'] ?? undefined,
      churchSlug:     churchSlug ?? localStorage.getItem('churchSlug') ?? undefined,
    }
  } catch {
    return null
  }
}

function applyChurchSlug(slug: string | null | undefined) {
  if (slug) {
    localStorage.setItem('churchSlug', slug)
    api.defaults.headers.common['X-Church-Slug'] = slug
  } else {
    localStorage.removeItem('churchSlug')
    delete api.defaults.headers.common['X-Church-Slug']
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Rehydrate from localStorage on every page load
  const stored = localStorage.getItem('token')
  if (stored) {
    api.defaults.headers.common['Authorization'] = `Bearer ${stored}`
    applyChurchSlug(localStorage.getItem('churchSlug'))
  }

  const [token, setToken] = useState<string | null>(stored)
  const [user, setUser]   = useState<UserInfo | null>(stored ? decodeToken(stored) : null)

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password })
    const t: string = res.data.token
    const slug: string | undefined = res.data.user?.churchSlug
    setToken(t)
    localStorage.setItem('token', t)
    api.defaults.headers.common['Authorization'] = `Bearer ${t}`
    applyChurchSlug(slug)
    setUser(decodeToken(t, slug))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    applyChurchSlug(null)
  }

  const hasRole = (role: string): boolean =>
    !!user?.role && (user.role === role || user.role.split(',').includes(role))

  return (
    <AuthContext.Provider value={{ token, user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
