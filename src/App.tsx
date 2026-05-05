import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/auth-context'
import { ThemeProvider } from '@/hooks/use-theme'
const AuthScreen = lazy(() => import('@/features/auth/auth-screen'))
const AuthenticatedApp = lazy(() => import('@/components/authenticated-app'))

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
                Loading...
              </div>
            }
          >
            <Routes>
              <Route path="/auth" element={<AuthScreen />} />
              <Route path="/" element={<AuthenticatedApp />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
