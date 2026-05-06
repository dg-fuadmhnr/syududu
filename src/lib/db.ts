import Dexie, { type Table } from 'dexie'

export type SyncState = 'pending' | 'synced' | 'error'

export type LocalGroup = {
  id: string
  userId: string
  name: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  syncState: SyncState
}

export type LocalNote = {
  id: string
  userId: string
  groupId: string
  content: string
  pinnedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  syncState: SyncState
}

export type LocalNoteTag = {
  id: string
  userId: string
  noteId: string
  name: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  syncState: SyncState
}

export type LocalNoteAttachment = {
  id: string
  userId: string
  noteId: string
  name: string
  mimeType: string
  dataUrl: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  syncState: SyncState
}

export class SyududuDB extends Dexie {
  groups!: Table<LocalGroup, string>
  notes!: Table<LocalNote, string>
  noteAttachments!: Table<LocalNoteAttachment, string>
  noteTags!: Table<LocalNoteTag, string>

  constructor() {
    super('syududu')

    this.version(1).stores({
      groups: 'id, userId, name, createdAt, updatedAt, syncState',
      notes: 'id, userId, groupId, createdAt, updatedAt, syncState, content',
    })

    this.version(2).stores({
      groups: 'id, userId, name, createdAt, updatedAt, deletedAt, syncState',
      notes: 'id, userId, groupId, createdAt, updatedAt, deletedAt, syncState, content',
    })

    this.version(3).stores({
      groups: 'id, userId, name, createdAt, updatedAt, deletedAt, syncState',
      notes: 'id, userId, groupId, createdAt, updatedAt, deletedAt, syncState, content',
      noteAttachments:
        'id, userId, noteId, sortOrder, createdAt, updatedAt, deletedAt, syncState, mimeType, name',
    })

    this.version(4)
      .stores({
        groups: 'id, userId, name, createdAt, updatedAt, deletedAt, syncState',
        notes: 'id, userId, groupId, pinnedAt, createdAt, updatedAt, deletedAt, syncState, content',
        noteAttachments:
          'id, userId, noteId, sortOrder, createdAt, updatedAt, deletedAt, syncState, mimeType, name',
        noteTags: 'id, userId, noteId, name, createdAt, updatedAt, deletedAt, syncState',
      })
      .upgrade(async (tx) => {
        await tx.table('notes').toCollection().modify((note: Partial<LocalNote>) => {
          if (note.pinnedAt === undefined) {
            note.pinnedAt = null
          }
        })
      })
  }
}

export const db = new SyududuDB()
