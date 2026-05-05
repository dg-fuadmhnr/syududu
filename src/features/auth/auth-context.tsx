/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

type AuthValue = {
  session: Session | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState<string | null>(
    isSupabaseConfigured ? null : 'Missing Supabase env vars.',
  )

  useEffect(() => {
    const client = supabase
    if (!client) {
      return
    }

    let mounted = true

    const bootstrap = async () => {
      const { data, error: sessionError } = await client.auth.getSession()
      if (!mounted) return

      if (sessionError) {
        setError(sessionError.message)
      }

      setSession(data.session)
      setLoading(false)
    }

    void bootstrap()

    const { data } = client.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) return 'Missing Supabase env vars.'

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    return signInError?.message ?? null
  }

  const signUp = async (email: string, password: string) => {
    if (!supabase) return 'Missing Supabase env vars.'

    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    return signUpError?.message ?? null
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        error,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return value
}

export function useSupabaseReady() {
  return isSupabaseConfigured
}
