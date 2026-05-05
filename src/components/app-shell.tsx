import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  RiInformationLine,
  RiMenuLine,
  RiMoonLine,
  RiRefreshLine,
  RiSunLine,
  RiLogoutBoxRLine,
} from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogDescription,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GroupsSidebar } from '@/features/groups/groups-sidebar'
import { NotesFeed } from '@/features/notes/notes-feed'
import { QuickInputBar } from '@/features/notes/quick-input-bar'
import { useAuth } from '@/features/auth/auth-context'
import { useAppStore } from '@/hooks/use-app-store'
import { useTheme } from '@/hooks/use-theme'

export function AppShell() {
  const { session, loading, signOut } = useAuth()
  const { searchQuery, setSearchQuery, syncNow } = useAppStore()
  const { theme, toggleTheme } = useTheme()
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/auth" replace />
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(120,70,30,0.16),_transparent_32%),linear-gradient(180deg,_#f7f3ed_0%,_#efe7dd_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top,_rgba(120,70,30,0.22),_transparent_28%),linear-gradient(180deg,_#16110d_0%,_#0f0b09_100%)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-2 py-2 sm:px-4 sm:py-3 lg:px-6">
        <header className="mb-2 flex flex-col gap-3 rounded-2xl border border-black/8 bg-white/70 px-3 py-3 shadow-[0_16px_40px_rgba(44,24,12,0.08)] backdrop-blur dark:border-white/10 dark:bg-black/25 lg:mb-3 lg:flex-row lg:items-center lg:justify-between lg:rounded-3xl lg:px-4">
          <div>
            <p className="font-heading text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
              syududu
            </p>
            <h1 className="font-heading text-lg font-semibold">Quick-capture notes</h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-1 lg:justify-end">
            <Button
              variant="outline"
              className="h-10 sm:hidden"
              onClick={() => setGroupsOpen(true)}
            >
              <RiMenuLine />
              <span>Groups</span>
            </Button>
            <Input
              className="w-full sm:min-w-[240px] sm:max-w-sm"
              placeholder="Search notes"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-10" onClick={() => void syncNow()}>
                <RiRefreshLine />
                <span>Sync</span>
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="App info"
                onClick={() => setInfoOpen(true)}
              >
                <RiInformationLine />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <RiSunLine /> : <RiMoonLine />}
              </Button>
              <Button variant="outline" size="icon-sm" aria-label="Sign out" onClick={() => void signOut()}>
                <RiLogoutBoxRLine />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-2 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-3">
          <aside className="hidden min-h-0 lg:sticky lg:top-3 lg:block lg:self-start">
            <GroupsSidebar />
          </aside>

          <section className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-3">
            <NotesFeed />
            <QuickInputBar />
          </section>
        </main>
      </div>

      <Dialog open={groupsOpen} onOpenChange={setGroupsOpen}>
        <DialogContent className="max-h-[88dvh] max-w-[96vw] overflow-y-auto p-3 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Groups</DialogTitle>
          </DialogHeader>
          <GroupsSidebar />
        </DialogContent>
      </Dialog>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-lg p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle>syududu</DialogTitle>
            <DialogDescription>created with laugh by Fuad Muhammad N</DialogDescription>
          </DialogHeader>
          <p className="text-base leading-8 text-foreground">
            &quot;loh eh, maskodi alkaya&apos;mafa ii alakaya&apos;naka syududu ma faqoli inna ya
            rasull al qoli inna kalyamafa? mus alas ali alak takola ya fima allah&quot;
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
