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
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  syncState: SyncState
}

export class SyududuDB extends Dexie {
  groups!: Table<LocalGroup, string>
  notes!: Table<LocalNote, string>

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
  }
}

export const db = new SyududuDB()
