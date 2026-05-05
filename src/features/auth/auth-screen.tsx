import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth, useSupabaseReady } from '@/features/auth/auth-context'

export function AuthScreen() {
  const navigate = useNavigate()
  const { session, signIn, error } = useAuth()
  const supabaseReady = useSupabaseReady()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true })
    }
  }, [navigate, session])

  const submit = async () => {
    setBusy(true)
    setMessage(null)

    const result = await signIn(email, password)

    setBusy(false)
    if (result) {
      setMessage(result)
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(120,70,30,0.18),_transparent_30%),linear-gradient(180deg,_#f7f3ed_0%,_#efe7dd_100%)] px-4 dark:bg-[radial-gradient(circle_at_top,_rgba(120,70,30,0.2),_transparent_28%),linear-gradient(180deg,_#16110d_0%,_#0f0b09_100%)]">
      <div className="w-full max-w-md rounded-3xl border border-black/8 bg-white/75 p-6 shadow-[0_18px_50px_rgba(44,24,12,0.1)] backdrop-blur dark:border-white/10 dark:bg-black/30">
        <p className="font-heading text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
          syududu
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {supabaseReady
            ? 'Email/password via Supabase.'
            : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.'}
        </p>

        <form
          className="mt-6 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button className="h-11 rounded-xl" disabled={busy || !supabaseReady} type="submit">
            Sign in
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </div>
    </div>
  )
}

export default AuthScreen
