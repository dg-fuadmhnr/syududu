import type { Session } from '@supabase/supabase-js'
import { db, type LocalGroup, type LocalNote } from '@/lib/db'
import { supabase } from '@/lib/supabase'

type RemoteGroup = {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type RemoteNote = {
  id: string
  user_id: string
  group_id: string
  content: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function toLocalGroup(row: RemoteGroup): LocalGroup {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncState: 'synced',
  }
}

function toLocalNote(row: RemoteNote): LocalNote {
  return {
    id: row.id,
    userId: row.user_id,
    groupId: row.group_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncState: 'synced',
  }
}

async function pushGroups(userId: string) {
  const pendingGroups = await db.groups.where('userId').equals(userId).toArray()

  const upserts = pendingGroups.filter((group) => group.syncState !== 'synced' && !group.deletedAt)
  const deletions = pendingGroups.filter((group) => group.deletedAt)

  if (upserts.length > 0) {
    const { error } = await supabase!
      .from('groups')
      .upsert(
        upserts.map((group) => ({
          id: group.id,
          user_id: group.userId,
          name: group.name,
          created_at: group.createdAt,
          updated_at: group.updatedAt,
          deleted_at: group.deletedAt,
        })),
      )

    if (error) throw error
  }

  for (const group of deletions) {
    const { error } = await supabase!.from('groups').delete().eq('id', group.id).eq('user_id', userId)
    if (error) throw error
  }
}

async function pushNotes(userId: string) {
  const pendingNotes = await db.notes.where('userId').equals(userId).toArray()

  const upserts = pendingNotes.filter((note) => note.syncState !== 'synced' && !note.deletedAt)
  const deletions = pendingNotes.filter((note) => note.deletedAt)

  if (upserts.length > 0) {
    const { error } = await supabase!
      .from('notes')
      .upsert(
        upserts.map((note) => ({
          id: note.id,
          user_id: note.userId,
          group_id: note.groupId,
          content: note.content,
          created_at: note.createdAt,
          updated_at: note.updatedAt,
          deleted_at: note.deletedAt,
        })),
      )

    if (error) throw error
  }

  for (const note of deletions) {
    const { error } = await supabase!.from('notes').delete().eq('id', note.id).eq('user_id', userId)
    if (error) throw error
  }
}

async function pullGroups(userId: string) {
  const { data, error } = await supabase!
    .from('groups')
    .select('id,user_id,name,created_at,updated_at,deleted_at')
    .eq('user_id', userId)

  if (error) throw error

  const remoteGroups = (data ?? []) as RemoteGroup[]
  const remoteIds = new Set(remoteGroups.map((row) => row.id))

  await db.transaction('rw', db.groups, async () => {
    for (const row of remoteGroups) {
      await db.groups.put(toLocalGroup(row))
    }

    const localGroups = await db.groups.where('userId').equals(userId).toArray()
    for (const group of localGroups) {
      if (!remoteIds.has(group.id) && group.syncState === 'synced') {
        await db.groups.delete(group.id)
      }
    }
  })
}

async function pullNotes(userId: string) {
  const { data, error } = await supabase!
    .from('notes')
    .select('id,user_id,group_id,content,created_at,updated_at,deleted_at')
    .eq('user_id', userId)

  if (error) throw error

  const remoteNotes = (data ?? []) as RemoteNote[]
  const remoteIds = new Set(remoteNotes.map((row) => row.id))

  await db.transaction('rw', db.notes, async () => {
    for (const row of remoteNotes) {
      await db.notes.put(toLocalNote(row))
    }

    const localNotes = await db.notes.where('userId').equals(userId).toArray()
    for (const note of localNotes) {
      if (!remoteIds.has(note.id) && note.syncState === 'synced') {
        await db.notes.delete(note.id)
      }
    }
  })
}

export async function syncWithSupabase(session: Session | null) {
  if (!supabase || !session) return

  const userId = session.user.id

  await pushGroups(userId)
  await pushNotes(userId)
  await pullGroups(userId)
  await pullNotes(userId)

  const localGroups = await db.groups.where('userId').equals(userId).toArray()
  const localNotes = await db.notes.where('userId').equals(userId).toArray()

  await db.groups.bulkPut(
    localGroups.map((group) => ({
      ...group,
      syncState: group.deletedAt ? 'synced' : 'synced',
    })),
  )
  await db.notes.bulkPut(
    localNotes.map((note) => ({
      ...note,
      syncState: note.deletedAt ? 'synced' : 'synced',
    })),
  )

  const deletedGroups = await db.groups.where('userId').equals(userId).and((group) => group.deletedAt !== null).toArray()
  const deletedNotes = await db.notes.where('userId').equals(userId).and((note) => note.deletedAt !== null).toArray()

  for (const group of deletedGroups) {
    await db.groups.delete(group.id)
  }
  for (const note of deletedNotes) {
    await db.notes.delete(note.id)
  }
}
