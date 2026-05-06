import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/hooks/use-app-store'
import { RiAddLine, RiDeleteBin6Line, RiEdit2Line } from '@remixicon/react'

export function GroupsSidebar() {
  const { groups, notes, selectedGroupId, setSelectedGroupId, createGroup, renameGroup, deleteGroup } =
    useAppStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [groupName, setGroupName] = useState('')

  const counts = notes.reduce<Record<string, number>>((acc, note) => {
    acc[note.groupId] = (acc[note.groupId] ?? 0) + 1
    return acc
  }, {})

  const addGroup = async () => {
    setGroupName('')
    setCreateOpen(true)
  }

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null

  const renameSelected = async () => {
    if (!selectedGroup) return
    setGroupName(selectedGroup.name)
    setRenameOpen(true)
  }

  const deleteSelected = async () => {
    if (!selectedGroup) return
    setDeleteOpen(true)
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-black/8 bg-white/75 p-3 shadow-[0_16px_40px_rgba(44,24,12,0.08)] backdrop-blur motion-safe:animate-[float-in_300ms_ease-out] dark:border-white/10 dark:bg-black/25 lg:rounded-3xl">
      <div className="flex items-center justify-between px-1 py-2">
        <div>
          <p className="font-heading text-sm font-semibold">Channels</p>
          <p className="text-xs text-muted-foreground">Groups and notes</p>
        </div>
        <Button variant="outline" size="icon-sm" aria-label="Add group" onClick={() => void addGroup()}>
          <RiAddLine />
        </Button>
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
        {groups.map((group, index) => {
          const active = group.id === selectedGroupId

          return (
            <button
              key={group.id}
              className={[
                'flex min-w-[140px] flex-1 items-center justify-between rounded-2xl border px-3 py-3 text-left transition motion-safe:animate-[fade-up_220ms_ease-out] motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-0.5 lg:min-w-0',
                active
                  ? 'border-primary/30 bg-primary/10 text-foreground'
                  : 'border-transparent bg-muted/60 text-muted-foreground hover:border-border hover:bg-muted',
              ].join(' ')}
              style={{ animationDelay: `${index * 35}ms` }}
              onClick={() => setSelectedGroupId(group.id)}
              type="button"
            >
              <span className="font-medium">{group.name}</span>
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px]">
                {counts[group.id] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-4 lg:grid-cols-1">
        <Button variant="outline" className="justify-start" onClick={() => void renameSelected()}>
          <RiEdit2Line />
          <span>Rename group</span>
        </Button>
        <Button variant="destructive" className="justify-start" onClick={() => void deleteSelected()}>
          <RiDeleteBin6Line />
          <span>Delete group</span>
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New group</DialogTitle>
            <DialogDescription>Create a new note channel.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              autoFocus
              placeholder="Group name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await createGroup(groupName)
                setCreateOpen(false)
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename group</DialogTitle>
            <DialogDescription>Change selected group name.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              autoFocus
              placeholder="Group name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (selectedGroup) {
                  await renameGroup(selectedGroup.id, groupName)
                }
                setRenameOpen(false)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete group</DialogTitle>
            <DialogDescription>This removes the group and its notes.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (selectedGroup) {
                  await deleteGroup(selectedGroup.id)
                }
                setDeleteOpen(false)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
