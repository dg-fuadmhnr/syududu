import { AppShell } from '@/components/app-shell'
import { AppStoreProvider } from '@/hooks/use-app-store'

export function AuthenticatedApp() {
  return (
    <AppStoreProvider>
      <AppShell />
    </AppStoreProvider>
  )
}

export default AuthenticatedApp
