/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { db, type LocalGroup, type LocalNote } from '@/lib/db'
import { useAuth } from '@/features/auth/auth-context'

type AppStoreValue = {
  groups: LocalGroup[]
  notes: LocalNote[]
  selectedGroupId: string | null
  searchQuery: string
  setSearchQuery: (value: string) => void
  setSelectedGroupId: (groupId: string) => void
  createGroup: (name: string) => Promise<void>
  renameGroup: (groupId: string, name: string) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  createNote: (content: string) => Promise<void>
  deleteNote: (noteId: string) => Promise<void>
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

const GROUP_KEY = 'syududu.selected-group-id'

function nowIso() {
  return new Date().toISOString()
}

function sortNewestLast<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [groups, setGroups] = useState<LocalGroup[]>([])
  const [notes, setNotes] = useState<LocalNote[]>([])
  const [selectedGroupId, setSelectedGroupIdState] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [syncTick, setSyncTick] = useState(0)

  useEffect(() => {
    let active = true

    const load = async () => {
      const existingGroups = sortNewestLast((await db.groups.toArray()).filter((group) => group.deletedAt === null))

      if (existingGroups.length === 0) {
        const seedGroup: LocalGroup = {
          id: crypto.randomUUID(),
          userId: session?.user.id ?? 'local',
          name: 'Personal',
          createdAt: nowIso(),
          updatedAt: nowIso(),
          deletedAt: null,
          syncState: 'pending',
        }

        await db.groups.add(seedGroup)
        if (!active) return
        setGroups([seedGroup])
        setSelectedGroupIdState(seedGroup.id)
        return
      }

      const selectedFromStorage = localStorage.getItem(GROUP_KEY)
      const selectedId = selectedFromStorage && existingGroups.some((group) => group.id === selectedFromStorage)
        ? selectedFromStorage
        : existingGroups[0]?.id ?? null

      const existingNotes = sortNewestLast((await db.notes.toArray()).filter((note) => note.deletedAt === null))

      if (!active) return
      setGroups(existingGroups)
      setNotes(existingNotes)
      setSelectedGroupIdState(selectedId)

      if (selectedId) {
        localStorage.setItem(GROUP_KEY, selectedId)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [session?.user.id])

  useEffect(() => {
    if (!session) return

    const userId = session.user.id

    const migrateLocalRows = async () => {
      const [localGroups, localNotes] = await Promise.all([
        db.groups.where('userId').equals('local').toArray(),
        db.notes.where('userId').equals('local').toArray(),
      ])

      if (localGroups.length === 0 && localNotes.length === 0) {
        return
      }

      await db.transaction('rw', db.groups, db.notes, async () => {
        for (const group of localGroups) {
          await db.groups.update(group.id, {
            userId,
            syncState: 'pending',
            updatedAt: nowIso(),
          })
        }
        for (const note of localNotes) {
          await db.notes.update(note.id, {
            userId,
            syncState: 'pending',
            updatedAt: nowIso(),
          })
        }
      })
    }

    void migrateLocalRows()
  }, [session])

  async function refresh() {
    const [allGroups, allNotes] = await Promise.all([db.groups.toArray(), db.notes.toArray()])
    const nextGroups = allGroups.filter((group) => group.deletedAt === null)
    const nextNotes = allNotes.filter((note) => note.deletedAt === null)
    setGroups(sortNewestLast(nextGroups))
    setNotes(sortNewestLast(nextNotes))
  }

  useEffect(() => {
    if (!session || !navigator.onLine) return

    let cancelled = false

    const runSync = async () => {
      try {
        const { syncWithSupabase } = await import('@/lib/sync')
        await syncWithSupabase(session)
        if (cancelled) return
        await refresh()
      } catch (error) {
        console.error('Supabase sync failed', error)
      }
    }

    void runSync()

    return () => {
      cancelled = true
    }
  }, [session, syncTick])

  useEffect(() => {
    const handleOnline = () => {
      setSyncTick((value) => value + 1)
    }

    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  const setSelectedGroupId = (groupId: string) => {
    setSelectedGroupIdState(groupId)
    localStorage.setItem(GROUP_KEY, groupId)
  }

  const createGroup = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return

    const nextGroup: LocalGroup = {
      id: crypto.randomUUID(),
      userId: session?.user.id ?? 'local',
      name: trimmed,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
      syncState: 'pending',
    }

    await db.groups.add(nextGroup)
    await refresh()
    setSelectedGroupId(nextGroup.id)
    setSyncTick((value) => value + 1)
  }

  const renameGroup = async (groupId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return

    await db.groups.update(groupId, {
      name: trimmed,
      updatedAt: nowIso(),
      syncState: 'pending',
    })
    await refresh()
    setSyncTick((value) => value + 1)
  }

  const deleteGroup = async (groupId: string) => {
    await db.transaction('rw', db.groups, db.notes, async () => {
      await db.notes.where('groupId').equals(groupId).modify({
        deletedAt: nowIso(),
        syncState: 'pending',
      })
      await db.groups.update(groupId, {
        deletedAt: nowIso(),
        syncState: 'pending',
      })
    })

    const nextGroups = sortNewestLast((await db.groups.toArray()).filter((group) => group.deletedAt === null))
    const fallbackGroupId = nextGroups[0]?.id ?? null

    setGroups(nextGroups)
    setNotes(sortNewestLast((await db.notes.toArray()).filter((note) => note.deletedAt === null)))
    setSelectedGroupIdState(fallbackGroupId)

    if (fallbackGroupId) {
      localStorage.setItem(GROUP_KEY, fallbackGroupId)
    } else {
      localStorage.removeItem(GROUP_KEY)
    }
    setSyncTick((value) => value + 1)
  }

  const createNote = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return

    const targetGroupId = selectedGroupId ?? groups[0]?.id
    if (!targetGroupId) return

    const nextNote: LocalNote = {
      id: crypto.randomUUID(),
      userId: session?.user.id ?? 'local',
      groupId: targetGroupId,
      content: trimmed,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
      syncState: 'pending',
    }

    await db.notes.add(nextNote)
    await refresh()
    setSyncTick((value) => value + 1)
  }

  const deleteNote = async (noteId: string) => {
    await db.notes.update(noteId, {
      deletedAt: nowIso(),
      syncState: 'pending',
    })
    await refresh()
    setSyncTick((value) => value + 1)
  }

  return (
    <AppStoreContext.Provider
      value={{
        groups,
        notes,
        selectedGroupId,
        searchQuery,
        setSearchQuery,
        setSelectedGroupId,
        createGroup,
        renameGroup,
        deleteGroup,
        createNote,
        deleteNote,
      }}
    >
      {children}
    </AppStoreContext.Provider>
  )
}

export function useAppStore() {
  const value = useContext(AppStoreContext)
  if (!value) {
    throw new Error('useAppStore must be used inside AppStoreProvider')
  }

  return value
}
