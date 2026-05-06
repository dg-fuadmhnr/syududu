import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { RiDeleteBin6Line, RiPencilLine, RiImageAddLine, RiCloseLine, RiPushpinLine } from '@remixicon/react'
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
import type { LocalNoteAttachment, LocalNoteTag } from '@/lib/db'
import type { DraftAttachment } from '@/lib/note-attachments'

const MarkdownRenderer = lazy(() => import('@/components/markdown-renderer'))

type LightboxAttachment = Pick<LocalNoteAttachment, 'name' | 'dataUrl' | 'mimeType'>

type DraftAttachmentItem = DraftAttachment

function sortAttachments(attachments: LocalNoteAttachment[]) {
  return [...attachments].sort((left, right) => left.sortOrder - right.sortOrder)
}

function sortTags(tags: LocalNoteTag[]) {
  return [...tags].sort((left, right) => left.name.localeCompare(right.name))
}

function parseTagInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean),
    ),
  )
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
  tags,
  onClose,
  onSave,
}: {
  note: { id: string; content: string }
  attachments: LocalNoteAttachment[]
  tags: string[]
  onClose: () => void
  onSave: (content: string, attachments: DraftAttachment[], tags: string[]) => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const [body, setBody] = useState(note.content)
  const [tagText, setTagText] = useState(tags.join(', '))
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

  const blockBackspaceAtStart = (event: KeyboardEvent<HTMLTextAreaElement> | FormEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget
    const selectionStart = textarea.selectionStart ?? 0
    const selectionEnd = textarea.selectionEnd ?? 0
    const atStart = selectionStart === 0 && selectionEnd === 0
    const nativeEvent = event.nativeEvent as InputEvent & { inputType?: string }
    const deletingBackward =
      ('key' in event && event.key === 'Backspace') || nativeEvent.inputType === 'deleteContentBackward'

    if (atStart && deletingBackward && !('isComposing' in event && event.isComposing)) {
      event.preventDefault()
    }
  }

  useEffect(() => {
    const textarea = bodyRef.current
    if (!textarea) return

    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [])

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
          <DialogDescription>Update note text, tags, and images. Cmd/Ctrl+Enter saves.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Textarea
            ref={bodyRef}
            data-autofocus
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onBeforeInput={blockBackspaceAtStart}
            onKeyDown={blockBackspaceAtStart}
            className="min-h-48 text-base leading-6 sm:text-sm"
          />

          <Input
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            placeholder="Tags, comma-separated"
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
                parseTagInput(tagText),
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
  const {
    groups,
    notes,
    attachments,
    noteTags,
    selectedGroupId,
    searchQuery,
    tagFilter,
    setTagFilter,
    editNote,
    deleteNote,
    togglePinNote,
  } = useAppStore()
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

  const tagsByNoteId = useMemo(() => {
    const map = new Map<string, LocalNoteTag[]>()

    for (const tag of sortTags(noteTags)) {
      const current = map.get(tag.noteId) ?? []
      current.push(tag)
      map.set(tag.noteId, current)
    }

    return map
  }, [noteTags])

  const visibleNotes = useMemo(() => {
    return notes.filter((note) => {
      const noteTagsText = tagsByNoteId.get(note.id)?.map((tag) => tag.name).join(' ') ?? ''
      const matchesSearch = deferredQuery ? `${note.content} ${noteTagsText}`.toLowerCase().includes(deferredQuery) : true
      const matchesTag = tagFilter ? tagsByNoteId.get(note.id)?.some((tag) => tag.name === tagFilter) : true
      const matchesGroup = deferredQuery ? true : selectedGroup ? note.groupId === selectedGroup.id : true
      return matchesGroup && matchesSearch && matchesTag
    })
  }, [deferredQuery, notes, selectedGroup, tagFilter, tagsByNoteId])

  const pendingEditNote = useMemo(
    () => notes.find((note) => note.id === pendingEditId) ?? null,
    [notes, pendingEditId],
  )

  const pendingEditAttachments = useMemo(
    () => (pendingEditId ? attachmentsByNoteId.get(pendingEditId) ?? [] : []),
    [attachmentsByNoteId, pendingEditId],
  )

  const pendingEditTags = useMemo(
    () => (pendingEditId ? tagsByNoteId.get(pendingEditId) ?? [] : []),
    [pendingEditId, tagsByNoteId],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-black/8 bg-white/75 shadow-[0_16px_40px_rgba(44,24,12,0.08)] backdrop-blur dark:border-white/10 dark:bg-black/25 lg:rounded-3xl">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/10">
        <div>
          <p className="font-heading text-sm font-semibold">{selectedGroup?.name ?? 'No group'}</p>
          <p className="text-xs text-muted-foreground">Newest notes at bottom</p>
        </div>
        <div className="flex items-center gap-2">
          {tagFilter ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-full px-3 text-[11px] uppercase tracking-[0.18em]"
              onClick={() => setTagFilter(null)}
            >
              #{tagFilter} x
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">{visibleNotes.length} notes</span>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
        {visibleNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
            No notes yet. Capture one below.
          </div>
        ) : (
          visibleNotes.map((note) => {
            const noteAttachments = attachmentsByNoteId.get(note.id) ?? []
            const noteTags = tagsByNoteId.get(note.id) ?? []

            return (
              <article
                key={note.id}
                className={[
                  'max-w-3xl rounded-2xl rounded-bl-md border bg-background px-3 py-3 shadow-sm dark:border-white/10 sm:px-4',
                  note.pinnedAt ? 'border-primary/25 ring-1 ring-primary/10' : 'border-black/5',
                ].join(' ')}
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
                      {note.pinnedAt ? (
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 normal-case tracking-normal text-primary">
                          pinned
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="h-8 w-8 shrink-0"
                      aria-label={note.pinnedAt ? 'Unpin note' : 'Pin note'}
                      onClick={() => void togglePinNote(note.id)}
                    >
                      <RiPushpinLine />
                    </Button>
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

                {noteTags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {noteTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className={[
                          'rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] transition',
                          tagFilter === tag.name
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-border bg-muted/50 text-muted-foreground hover:border-ring/50 hover:bg-muted',
                        ].join(' ')}
                        onClick={() => setTagFilter(tagFilter === tag.name ? null : tag.name)}
                      >
                        #{tag.name}
                      </button>
                    ))}
                  </div>
                ) : null}

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
          tags={pendingEditTags.map((tag) => tag.name)}
          onClose={() => setPendingEditId(null)}
          onSave={(content, nextAttachments, nextTags) => {
            void editNote(pendingEditNote.id, content, nextAttachments, nextTags)
          }}
        />
      ) : null}

      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent className="max-w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete note</DialogTitle>
            <DialogDescription>This note will move to undo state first, then sync delete to Supabase.</DialogDescription>
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
