'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ThemeTransition } from './theme-transition'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [pending, setPending] = useState<Theme | null>(null)
  const pendingRef = useRef<Theme | null>(null)
  const animatingRef = useRef(false)

  // Sync initial React state from the class the no-flash script already set.
  useEffect(() => {
    setThemeState(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  const persist = useCallback((t: Theme) => {
    try {
      localStorage.setItem('theme', t)
      const token = localStorage.getItem('accessToken')
      if (token) {
        void fetch(`${API_URL}/auth/me`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ theme: t }),
        }).catch(() => {})
      }
    } catch {
      /* storage unavailable — ignore */
    }
  }, [])

  const apply = useCallback(
    (t: Theme) => {
      document.documentElement.classList.toggle('dark', t === 'dark')
      setThemeState(t)
      persist(t)
    },
    [persist],
  )

  const setTheme = useCallback((t: Theme) => apply(t), [apply])

  const toggle = useCallback(() => {
    if (animatingRef.current) return
    const next: Theme = theme === 'light' ? 'dark' : 'light'

    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      apply(next)
      return
    }

    animatingRef.current = true
    document.documentElement.classList.add('theme-transitioning')
    pendingRef.current = next
    setPending(next)
  }, [theme, apply])

  const handleMidpoint = useCallback(() => {
    if (pendingRef.current) apply(pendingRef.current)
  }, [apply])

  const handleDone = useCallback(() => {
    pendingRef.current = null
    setPending(null)
    animatingRef.current = false
    document.documentElement.classList.remove('theme-transitioning')
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
      {pending && <ThemeTransition to={pending} onMidpoint={handleMidpoint} onDone={handleDone} />}
    </ThemeContext.Provider>
  )
}
