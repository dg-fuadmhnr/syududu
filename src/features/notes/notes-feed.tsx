import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react'
import { RiDeleteBin6Line, RiPencilLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/hooks/use-app-store'

const MarkdownRenderer = lazy(() => import('@/components/markdown-renderer'))

export function NotesFeed() {
  const { groups, notes, selectedGroupId, searchQuery, editNote, deleteNote } = useAppStore()
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase())
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingEditId, setPendingEditId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  )

  const visibleNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchesSearch = deferredQuery ? note.content.toLowerCase().includes(deferredQuery) : true
      const matchesGroup = deferredQuery ? true : selectedGroup ? note.groupId === selectedGroup.id : true
      return matchesGroup && matchesSearch
    })
  }, [deferredQuery, notes, selectedGroup])

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-black/8 bg-white/75 shadow-[0_16px_40px_rgba(44,24,12,0.08)] backdrop-blur dark:border-white/10 dark:bg-black/25 lg:rounded-3xl">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/10">
        <div>
          <p className="font-heading text-sm font-semibold">{selectedGroup?.name ?? 'No group'}</p>
          <p className="text-xs text-muted-foreground">Newest notes at bottom</p>
        </div>
        <span className="text-xs text-muted-foreground">{visibleNotes.length} notes</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
        {visibleNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
            No notes yet. Capture one below.
          </div>
        ) : (
          visibleNotes.map((note) => (
            <article
              key={note.id}
              className="max-w-3xl rounded-2xl rounded-bl-md border border-black/5 bg-background px-3 py-3 shadow-sm dark:border-white/10 sm:px-4"
              style={{
                contentVisibility: 'auto',
                containIntrinsicSize: '0 180px',
              }}
            >
              <div className="mb-2 flex items-start justify-between gap-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                <div className="space-y-1">
                  <span>{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <time>{new Date(note.createdAt).toLocaleDateString()}</time>
                    {note.updatedAt !== note.createdAt ? <span className="normal-case tracking-normal text-muted-foreground">edited</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-8 w-8 shrink-0"
                    aria-label="Edit note"
                    onClick={() => {
                      setPendingEditId(note.id)
                      setEditContent(note.content)
                    }}
                  >
                    <RiPencilLine />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-8 w-8 shrink-0"
                    aria-label="Delete note"
                    onClick={() => setPendingDeleteId(note.id)}
                  >
                    <RiDeleteBin6Line />
                  </Button>
                </div>
              </div>
              <div className="max-w-none space-y-3 text-sm leading-6 text-foreground">
                <Suspense
                  fallback={
                    <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      Rendering markdown...
                    </div>
                  }
                >
                  <MarkdownRenderer content={note.content} />
                </Suspense>
              </div>
            </article>
          ))
        )}
      </div>

      <Dialog open={pendingEditId !== null} onOpenChange={(open) => !open && setPendingEditId(null)}>
        <DialogContent className="max-w-[92vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit note</DialogTitle>
            <DialogDescription>Update note text. Cmd/Ctrl+Enter saves.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Textarea
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              className="min-h-48 text-base leading-6 sm:text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingEditId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingEditId) {
                  void editNote(pendingEditId, editContent)
                }
                setPendingEditId(null)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent className="max-w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete note</DialogTitle>
            <DialogDescription>This note will be removed locally and synced to Supabase.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDeleteId) {
                  void deleteNote(pendingDeleteId)
                }
                setPendingDeleteId(null)
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
