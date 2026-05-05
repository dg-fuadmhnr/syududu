/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type ThemeMode = 'light' | 'dark'

type ThemeValue = {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

const THEME_KEY = 'syududu.theme'

const ThemeContext = createContext<ThemeValue | null>(null)

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'

  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem(THEME_KEY, theme)

    const themeColor = theme === 'dark' ? '#0f0b09' : '#f7f3ed'
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.append(meta)
    }

    meta.content = themeColor
  }, [theme])

  const value = useMemo<ThemeValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }

  return value
}
