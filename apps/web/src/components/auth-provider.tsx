'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'

export interface AuthUser {
  id: string
  email: string
  fullName: string | null
  role: 'admin' | 'manager' | 'employee'
  status: string
  theme: 'light' | 'dark'
  managerId: string | null
  canCreateCourses: boolean
  canManageAllCourses: boolean
  avatarId: string | null
  createdAt: string
  avatar: { storageKey: string; provider: string } | null
  manager: { id: string; fullName: string | null; email: string } | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signIn: (token: string, user: AuthUser) => void
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await apiGet<{ user: AuthUser }>('/auth/me')
      setUser(data.user)
    } catch {
      localStorage.removeItem('accessToken')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const signIn = useCallback((token: string, u: AuthUser) => {
    localStorage.setItem('accessToken', token)
    setUser(u)
    setLoading(false)
  }, [])

  const signOut = useCallback(async () => {
    localStorage.removeItem('accessToken')
    setUser(null)
    try {
      await apiPost('/auth/logout')
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh: load }}>
      {children}
    </AuthContext.Provider>
  )
}
