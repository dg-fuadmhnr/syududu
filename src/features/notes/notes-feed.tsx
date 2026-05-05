import { lazy, Suspense, useDeferredValue, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { RiDeleteBin6Line, RiPencilLine, RiImageAddLine, RiCloseLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import type { LocalNoteAttachment } from '@/lib/db'
import type { DraftAttachment } from '@/lib/note-attachments'

const MarkdownRenderer = lazy(() => import('@/components/markdown-renderer'))

type LightboxAttachment = Pick<LocalNoteAttachment, 'name' | 'dataUrl' | 'mimeType'>

type DraftAttachmentItem = DraftAttachment

function sortAttachments(attachments: LocalNoteAttachment[]) {
  return [...attachments].sort((left, right) => left.sortOrder - right.sortOrder)
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

async function loadImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = src
  })
}

async function compressImage(file: File) {
  const source = await readFileAsDataUrl(file)
  const image = await loadImage(source)

  const maxWidth = 1600
  const maxHeight = 1600
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
  const width = Math.max(1, Math.round(image.width * ratio))
  const height = Math.max(1, Math.round(image.height * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) return source

  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', 0.86)
}

function mimeTypeFromDataUrl(dataUrl: string) {
  if (dataUrl.startsWith('data:image/png')) return 'image/png'
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'image/jpeg'
  if (dataUrl.startsWith('data:image/webp')) return 'image/webp'
  if (dataUrl.startsWith('data:image/svg+xml')) return 'image/svg+xml'
  return 'image/*'
}

function sortDraftAttachments(attachments: DraftAttachmentItem[]) {
  return [...attachments].sort((left, right) => left.sortOrder - right.sortOrder)
}

function AttachmentGrid({
  attachments,
  onOpen,
}: {
  attachments: LocalNoteAttachment[]
  onOpen: (attachment: LightboxAttachment) => void
}) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {attachments.map((attachment) => (
        <button
          key={attachment.id}
          type="button"
          className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-2 text-left transition hover:border-ring/50 hover:bg-muted/50"
          onClick={() => onOpen(attachment)}
        >
          <img
            alt={attachment.name}
            src={attachment.dataUrl}
            className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{attachment.name}</p>
            <p className="text-xs text-muted-foreground">Tap to preview</p>
          </div>
        </button>
      ))}
    </div>
  )
}

function DraftAttachmentGrid({
  attachments,
  onRemove,
  onOpen,
}: {
  attachments: DraftAttachmentItem[]
  onRemove: (id: string) => void
  onOpen: (attachment: LightboxAttachment) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-2"
        >
          <button type="button" className="shrink-0" onClick={() => onOpen(attachment)}>
            <img
              alt={attachment.name}
              src={attachment.dataUrl}
              className="h-16 w-16 rounded-xl border border-border object-cover"
            />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{attachment.name}</p>
            <p className="text-xs text-muted-foreground">Preserved on save</p>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-8 w-8 shrink-0"
            aria-label={`Remove ${attachment.name}`}
            onClick={() => onRemove(attachment.id)}
          >
            <RiCloseLine />
          </Button>
        </div>
      ))}
    </div>
  )
}

function NoteEditDialog({
  note,
  attachments,
  onClose,
  onSave,
}: {
  note: { id: string; content: string }
  attachments: LocalNoteAttachment[]
  onClose: () => void
  onSave: (content: string, attachments: DraftAttachment[]) => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [body, setBody] = useState(note.content)
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachmentItem[]>(
    attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      dataUrl: attachment.dataUrl,
      sortOrder: attachment.sortOrder,
    })),
  )
  const [reading, setReading] = useState(false)

  const addFiles = async (files: FileList | File[]) => {
    const nextFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (nextFiles.length === 0) return

    setReading(true)
    try {
      const nextImages = await Promise.all(
        nextFiles.map(async (file) => ({
          id: crypto.randomUUID(),
          name: file.name || 'image',
          mimeType: file.type,
          dataUrl: file.type === 'image/svg+xml' ? await readFileAsDataUrl(file) : await compressImage(file),
          sortOrder: 0,
        })),
      )
      setDraftAttachments((current) =>
        sortDraftAttachments(
          [...current, ...nextImages].map((attachment, index) => ({
            ...attachment,
            sortOrder: index,
          })),
        ),
      )
    } finally {
      setReading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[92vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit note</DialogTitle>
          <DialogDescription>Update note text. Add or remove images. Cmd/Ctrl+Enter saves.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-48 text-base leading-6 sm:text-sm"
          />

          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              void addFiles(event.target.files ?? [])
              event.target.value = ''
            }}
          />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              type="button"
              className="h-10 rounded-xl"
              onClick={() => fileInputRef.current?.click()}
              disabled={reading}
            >
              <RiImageAddLine />
              <span>Add image</span>
            </Button>
            <span className="text-xs text-muted-foreground">Attachments stay separate from text.</span>
          </div>

          {draftAttachments.length > 0 ? (
            <DraftAttachmentGrid
              attachments={draftAttachments}
              onOpen={() => undefined}
              onRemove={(id) => setDraftAttachments((current) => current.filter((attachment) => attachment.id !== id))}
            />
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
            <Button
            onClick={() => {
              onSave(
                body,
                draftAttachments.map<DraftAttachment>((attachment, index) => ({
                  id: attachment.id,
                  name: attachment.name,
                  mimeType: attachment.mimeType || mimeTypeFromDataUrl(attachment.dataUrl),
                  dataUrl: attachment.dataUrl,
                  sortOrder: index,
                })),
              )
              onClose()
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function NotesFeed() {
  const { groups, notes, attachments, selectedGroupId, searchQuery, editNote, deleteNote } = useAppStore()
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase())
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingEditId, setPendingEditId] = useState<string | null>(null)
  const [previewAttachment, setPreviewAttachment] = useState<LightboxAttachment | null>(null)

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  )

  const attachmentsByNoteId = useMemo(() => {
    const map = new Map<string, LocalNoteAttachment[]>()

    for (const attachment of sortAttachments(attachments)) {
      const current = map.get(attachment.noteId) ?? []
      current.push(attachment)
      map.set(attachment.noteId, current)
    }

    return map
  }, [attachments])

  const visibleNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchesSearch = deferredQuery ? note.content.toLowerCase().includes(deferredQuery) : true
      const matchesGroup = deferredQuery ? true : selectedGroup ? note.groupId === selectedGroup.id : true
      return matchesGroup && matchesSearch
    })
  }, [deferredQuery, notes, selectedGroup])

  const pendingEditNote = useMemo(
    () => notes.find((note) => note.id === pendingEditId) ?? null,
    [notes, pendingEditId],
  )

  const pendingEditAttachments = useMemo(
    () => (pendingEditId ? attachmentsByNoteId.get(pendingEditId) ?? [] : []),
    [attachmentsByNoteId, pendingEditId],
  )

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
          visibleNotes.map((note) => {
            const noteAttachments = attachmentsByNoteId.get(note.id) ?? []

            return (
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
                      {note.updatedAt !== note.createdAt ? (
                        <span className="normal-case tracking-normal text-muted-foreground">edited</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="h-8 w-8 shrink-0"
                      aria-label="Edit note"
                      onClick={() => setPendingEditId(note.id)}
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

                {noteAttachments.length > 0 ? (
                  <AttachmentGrid
                    attachments={sortAttachments(noteAttachments)}
                    onOpen={(attachment) => setPreviewAttachment(attachment)}
                  />
                ) : null}
              </article>
            )
          })
        )}
      </div>

      {pendingEditNote ? (
        <NoteEditDialog
          key={pendingEditNote.id}
          note={pendingEditNote}
          attachments={pendingEditAttachments}
          onClose={() => setPendingEditId(null)}
          onSave={(content, nextAttachments) => {
            void editNote(pendingEditNote.id, content, nextAttachments)
          }}
        />
      ) : null}

      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent className="max-w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete note</DialogTitle>
            <DialogDescription>This note and its attachments will be removed locally and synced to Supabase.</DialogDescription>
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

      <Dialog open={previewAttachment !== null} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        <DialogContent className="max-w-[96vw] p-3 sm:max-w-5xl sm:p-4">
          {previewAttachment ? (
            <div className="flex max-h-[88dvh] items-center justify-center overflow-auto">
              <img
                alt={previewAttachment.name}
                src={previewAttachment.dataUrl}
                className="max-h-[84dvh] w-auto max-w-full rounded-2xl object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default NotesFeed
