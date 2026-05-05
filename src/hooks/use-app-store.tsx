/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { db, type LocalGroup, type LocalNote, type LocalNoteAttachment } from '@/lib/db'
import { useAuth } from '@/features/auth/auth-context'
import {
  extractInlineImages,
  mimeTypeFromDataUrl,
  type DraftAttachment,
  type NoteAttachmentInput,
} from '@/lib/note-attachments'

type AppStoreValue = {
  groups: LocalGroup[]
  notes: LocalNote[]
  attachments: LocalNoteAttachment[]
  selectedGroupId: string | null
  searchQuery: string
  setSearchQuery: (value: string) => void
  setSelectedGroupId: (groupId: string) => void
  createGroup: (name: string) => Promise<void>
  renameGroup: (groupId: string, name: string) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  createNote: (content: string, attachments?: NoteAttachmentInput[]) => Promise<void>
  editNote: (noteId: string, content: string, attachments?: DraftAttachment[]) => Promise<void>
  deleteNote: (noteId: string) => Promise<void>
  syncNow: () => Promise<void>
  isSyncing: boolean
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

const GROUP_KEY = 'syududu.selected-group-id'
const DEFAULT_GROUP_NAME = 'Sample Groups'

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
  const [attachments, setAttachments] = useState<LocalNoteAttachment[]>([])
  const [selectedGroupId, setSelectedGroupIdState] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [syncTick, setSyncTick] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncInFlightRef = useRef(false)

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
        const [localGroups, localNotes, localAttachments] = await Promise.all([
          db.groups.where('userId').equals('local').toArray(),
          db.notes.where('userId').equals('local').toArray(),
          db.noteAttachments.where('userId').equals('local').toArray(),
        ])

        if (localGroups.length > 0 || localNotes.length > 0 || localAttachments.length > 0) {
          await db.transaction('rw', db.groups, db.notes, db.noteAttachments, async () => {
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
            for (const attachment of localAttachments) {
              await db.noteAttachments.update(attachment.id, {
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

      let existingNotes = sortNewestLast(
        (await db.notes.where('userId').equals(ownerId).toArray()).filter((note) => note.deletedAt === null),
      )
      let existingAttachments = sortNewestLast(
        (await db.noteAttachments.where('userId').equals(ownerId).toArray()).filter(
          (attachment) => attachment.deletedAt === null,
        ),
      )

      const legacyInlineNotes = existingNotes.filter((note) => note.content.includes('!['))
      if (legacyInlineNotes.length > 0) {
        await db.transaction('rw', db.notes, db.noteAttachments, async () => {
          for (const note of legacyInlineNotes) {
            const { body, images } = extractInlineImages(note.content)
            if (images.length === 0) continue

            await db.notes.update(note.id, {
              content: body,
              updatedAt: nowIso(),
              syncState: 'pending',
            })

            const noteAttachments = images.map<LocalNoteAttachment>((image, index) => ({
              id: crypto.randomUUID(),
              userId: ownerId,
              noteId: note.id,
              name: image.name,
              mimeType: image.src.startsWith('data:image/png')
                ? 'image/png'
                : image.src.startsWith('data:image/jpeg') || image.src.startsWith('data:image/jpg')
                  ? 'image/jpeg'
                  : image.src.startsWith('data:image/webp')
                    ? 'image/webp'
                    : image.src.startsWith('data:image/svg+xml')
                      ? 'image/svg+xml'
                      : 'image/*',
              dataUrl: image.src,
              sortOrder: index,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              deletedAt: null,
              syncState: 'pending',
            }))

            await db.noteAttachments.bulkAdd(noteAttachments)
          }
        })
        existingNotes = sortNewestLast(
          (await db.notes.where('userId').equals(ownerId).toArray()).filter((note) => note.deletedAt === null),
        )
        existingAttachments = sortNewestLast(
          (await db.noteAttachments.where('userId').equals(ownerId).toArray()).filter(
            (attachment) => attachment.deletedAt === null,
          ),
        )
      }

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
      setAttachments(existingAttachments)
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
    const [allGroups, allNotes, allAttachments] = await Promise.all([
      db.groups.where('userId').equals(ownerId).toArray(),
      db.notes.where('userId').equals(ownerId).toArray(),
      db.noteAttachments.where('userId').equals(ownerId).toArray(),
    ])
    const nextGroups = allGroups.filter((group) => group.deletedAt === null)
    const nextNotes = allNotes.filter((note) => note.deletedAt === null)
    const nextAttachments = allAttachments.filter((attachment) => attachment.deletedAt === null)
    setGroups(sortNewestLast(nextGroups))
    setNotes(sortNewestLast(nextNotes))
    setAttachments(sortNewestLast(nextAttachments))
  }, [session])

  const syncNow = useCallback(async () => {
    if (!session || !navigator.onLine) return
    if (syncInFlightRef.current) return

    syncInFlightRef.current = true
    setIsSyncing(true)

    try {
      const { syncWithSupabase } = await import('@/lib/sync')
      await syncWithSupabase(session)
      await refresh()
    } finally {
      syncInFlightRef.current = false
      setIsSyncing(false)
    }
  }, [refresh, session])

  useEffect(() => {
    if (!session || !navigator.onLine) return

    let cancelled = false

    const runSync = async () => {
      try {
        await syncNow()
        if (cancelled) return
      } catch (error) {
        console.error('Supabase sync failed', error)
      }
    }

    void runSync()

    return () => {
      cancelled = true
    }
  }, [session, syncNow, syncTick])

  useEffect(() => {
    const handleOnline = () => {
      setSyncTick((value) => value + 1)
    }

    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  useEffect(() => {
    if (!session) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setSyncTick((value) => value + 1)
      }
    }

    const interval = window.setInterval(() => {
      if (navigator.onLine) {
        setSyncTick((value) => value + 1)
      }
    }, 30000)

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [session])

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
    const noteIds = await db.notes.where('groupId').equals(groupId).primaryKeys()

    await db.transaction('rw', db.groups, db.notes, db.noteAttachments, async () => {
      await db.notes.where('groupId').equals(groupId).modify({
        deletedAt: nowIso(),
        syncState: 'pending',
      })
      for (const noteId of noteIds) {
        await db.noteAttachments.where('noteId').equals(String(noteId)).modify({
          deletedAt: nowIso(),
          syncState: 'pending',
        })
      }
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

  const createNoteWithAttachments = async (content: string, attachments: NoteAttachmentInput[] = []) => {
    const trimmed = content.trim()
    const ownerId = getOwnerId(session)
    const targetGroupId = selectedGroupId ?? groups[0]?.id
    if (!targetGroupId) return
    if (!trimmed && attachments.length === 0) return

    const noteId = crypto.randomUUID()
    const now = nowIso()

    await db.transaction('rw', db.notes, db.noteAttachments, async () => {
      await db.notes.add({
        id: noteId,
        userId: ownerId,
        groupId: targetGroupId,
        content: trimmed,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncState: 'pending',
      })

      if (attachments.length > 0) {
        await db.noteAttachments.bulkAdd(
          attachments.map((attachment) => ({
            id: crypto.randomUUID(),
            userId: ownerId,
            noteId,
            name: attachment.name,
            mimeType: attachment.mimeType,
            dataUrl: attachment.dataUrl,
            sortOrder: attachment.sortOrder,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            syncState: 'pending',
          })),
        )
      }
    })

    await refresh()
    setSyncTick((value) => value + 1)
  }

  const editNote = async (noteId: string, content: string, attachments: DraftAttachment[] = []) => {
    const trimmed = content.trim()
    if (!trimmed && attachments.length === 0) return

    const now = nowIso()
    await db.transaction('rw', db.notes, db.noteAttachments, async () => {
      await db.notes.update(noteId, {
        content: trimmed,
        updatedAt: now,
        syncState: 'pending',
      })

      const existingAttachments = await db.noteAttachments.where('noteId').equals(noteId).toArray()
      const existingById = new Map(existingAttachments.map((attachment) => [attachment.id, attachment]))
      const incomingIds = new Set(attachments.map((attachment) => attachment.id))

      for (const existing of existingAttachments) {
        if (!incomingIds.has(existing.id)) {
          await db.noteAttachments.update(existing.id, {
            deletedAt: now,
            syncState: 'pending',
          })
        }
      }

      for (const [index, attachment] of attachments.entries()) {
        const existing = existingById.get(attachment.id)
        const nextAttachment = {
          id: attachment.id,
          userId: existing?.userId ?? getOwnerId(session),
          noteId,
          name: attachment.name,
          mimeType: attachment.mimeType || mimeTypeFromDataUrl(attachment.dataUrl),
          dataUrl: attachment.dataUrl,
          sortOrder: index,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          deletedAt: null,
          syncState: 'pending' as const,
        }

        await db.noteAttachments.put(nextAttachment)
      }
    })
    await refresh()
    setSyncTick((value) => value + 1)
  }

  const deleteNote = async (noteId: string) => {
    await db.transaction('rw', db.notes, db.noteAttachments, async () => {
      await db.notes.update(noteId, {
        deletedAt: nowIso(),
        syncState: 'pending',
      })
      await db.noteAttachments.where('noteId').equals(noteId).modify({
        deletedAt: nowIso(),
        syncState: 'pending',
      })
    })
    await refresh()
    setSyncTick((value) => value + 1)
  }

  return (
    <AppStoreContext.Provider
      value={{
        groups,
        notes,
        attachments,
        selectedGroupId,
        searchQuery,
        setSearchQuery,
        setSelectedGroupId,
        createGroup,
        renameGroup,
        deleteGroup,
        createNote: createNoteWithAttachments,
        editNote,
        deleteNote,
        syncNow,
        isSyncing,
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
