/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
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
  editNote: (noteId: string, content: string) => Promise<void>
  deleteNote: (noteId: string) => Promise<void>
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

const GROUP_KEY = 'syududu.selected-group-id'
const DEFAULT_GROUP_NAME = 'Personal'

function nowIso() {
  return new Date().toISOString()
}

function getOwnerId(session: { user: { id: string } } | null) {
  return session?.user.id ?? 'local'
}

function getSelectedGroupKey(ownerId: string) {
  return `${GROUP_KEY}:${ownerId}`
}

function getLegacyDefaultGroupId(ownerId: string) {
  return `syududu.default-group:${ownerId}`
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
      const ownerId = getOwnerId(session)
      let changed = false
      const legacyGroupId = getLegacyDefaultGroupId(ownerId)

      const legacyGroup = await db.groups.get(legacyGroupId)
      if (legacyGroup) {
        const migratedGroupId = crypto.randomUUID()
        const legacyNotes = await db.notes.where('groupId').equals(legacyGroupId).toArray()

        await db.transaction('rw', db.groups, db.notes, async () => {
          await db.groups.put({
            ...legacyGroup,
            id: migratedGroupId,
            updatedAt: nowIso(),
            syncState: 'pending',
          })

          for (const note of legacyNotes) {
            await db.notes.update(note.id, {
              groupId: migratedGroupId,
              updatedAt: nowIso(),
              syncState: 'pending',
            })
          }

          await db.groups.delete(legacyGroupId)
        })

        const selectedFromLegacy = localStorage.getItem(getSelectedGroupKey(ownerId)) ?? localStorage.getItem(GROUP_KEY)
        if (selectedFromLegacy === legacyGroupId) {
          localStorage.setItem(getSelectedGroupKey(ownerId), migratedGroupId)
        }
        changed = true
      }

      if (session) {
        const [localGroups, localNotes] = await Promise.all([
          db.groups.where('userId').equals('local').toArray(),
          db.notes.where('userId').equals('local').toArray(),
        ])

        if (localGroups.length > 0 || localNotes.length > 0) {
          await db.transaction('rw', db.groups, db.notes, async () => {
            for (const group of localGroups) {
              await db.groups.update(group.id, {
                userId: ownerId,
                syncState: 'pending',
                updatedAt: nowIso(),
              })
            }
            for (const note of localNotes) {
              await db.notes.update(note.id, {
                userId: ownerId,
                syncState: 'pending',
                updatedAt: nowIso(),
              })
            }
          })
          changed = true
        }
      }

      const existingGroups = sortNewestLast(
        (await db.groups.where('userId').equals(ownerId).toArray()).filter((group) => group.deletedAt === null),
      )

      const existingNotes = sortNewestLast(
        (await db.notes.where('userId').equals(ownerId).toArray()).filter((note) => note.deletedAt === null),
      )

      if (existingGroups.length === 0) {
        const seedGroup: LocalGroup = {
          id: crypto.randomUUID(),
          userId: ownerId,
          name: DEFAULT_GROUP_NAME,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          deletedAt: null,
          syncState: 'pending',
        }

        await db.groups.put(seedGroup)
        changed = true
        if (!active) return
        existingGroups.push(seedGroup)
        existingGroups.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      }

      const selectedFromStorage = localStorage.getItem(getSelectedGroupKey(ownerId)) ?? localStorage.getItem(GROUP_KEY)
      const selectedId = selectedFromStorage && existingGroups.some((group) => group.id === selectedFromStorage)
        ? selectedFromStorage
        : existingGroups[0]?.id ?? null

      if (!active) return
      setGroups(existingGroups)
      setNotes(existingNotes)
      setSelectedGroupIdState(selectedId)

      if (selectedId) {
        localStorage.setItem(getSelectedGroupKey(ownerId), selectedId)
      }

      if (changed) {
        setSyncTick((value) => value + 1)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [session])

  const refresh = useCallback(async () => {
    const ownerId = getOwnerId(session)
    const [allGroups, allNotes] = await Promise.all([
      db.groups.where('userId').equals(ownerId).toArray(),
      db.notes.where('userId').equals(ownerId).toArray(),
    ])
    const nextGroups = allGroups.filter((group) => group.deletedAt === null)
    const nextNotes = allNotes.filter((note) => note.deletedAt === null)
    setGroups(sortNewestLast(nextGroups))
    setNotes(sortNewestLast(nextNotes))
  }, [session])

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
  }, [refresh, session, syncTick])

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
    localStorage.setItem(getSelectedGroupKey(getOwnerId(session)), groupId)
  }

  const createGroup = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return

    const ownerId = getOwnerId(session)
    const nextGroup: LocalGroup = {
      id: crypto.randomUUID(),
      userId: ownerId,
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

    const ownerId = getOwnerId(session)
    const nextGroups = sortNewestLast(
      (await db.groups.where('userId').equals(ownerId).toArray()).filter((group) => group.deletedAt === null),
    )
    const fallbackGroupId = nextGroups[0]?.id ?? null

    setGroups(nextGroups)
    setNotes(
      sortNewestLast(
        (await db.notes.where('userId').equals(ownerId).toArray()).filter((note) => note.deletedAt === null),
      ),
    )
    setSelectedGroupIdState(fallbackGroupId)

    if (fallbackGroupId) {
      localStorage.setItem(getSelectedGroupKey(ownerId), fallbackGroupId)
    } else {
      localStorage.removeItem(getSelectedGroupKey(ownerId))
    }
    setSyncTick((value) => value + 1)
  }

  const createNote = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return

    const ownerId = getOwnerId(session)
    const targetGroupId = selectedGroupId ?? groups[0]?.id
    if (!targetGroupId) return

    const nextNote: LocalNote = {
      id: crypto.randomUUID(),
      userId: ownerId,
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

  const editNote = async (noteId: string, content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return

    await db.notes.update(noteId, {
      content: trimmed,
      updatedAt: nowIso(),
      syncState: 'pending',
    })
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
        editNote,
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
