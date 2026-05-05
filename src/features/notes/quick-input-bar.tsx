import { useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react'
import { RiCloseLine, RiImageAddLine, RiSave3Line } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/hooks/use-app-store'

type DraftImage = {
  id: string
  name: string
  src: string
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
  if (!context) {
    return source
  }

  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', 0.86)
}

function composeMarkdown(content: string, images: DraftImage[]) {
  const body = content.trim()
  const imageMarkdown = images.map((image) => `![${image.name}](${image.src})`).join('\n\n')

  if (body && imageMarkdown) return `${body}\n\n${imageMarkdown}`
  return body || imageMarkdown
}

export function QuickInputBar() {
  const { createNote } = useAppStore()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [content, setContent] = useState('')
  const [images, setImages] = useState<DraftImage[]>([])
  const [saving, setSaving] = useState(false)
  const [readingImages, setReadingImages] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const payload = composeMarkdown(content, images)
    if (!payload.trim()) return

    setSaving(true)
    setError(null)
    await createNote(payload)
    setContent('')
    setImages([])
    setSaving(false)
  }

  const addFiles = async (files: FileList | File[]) => {
    const nextFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (nextFiles.length === 0) return

    setReadingImages(true)
    setError(null)

    try {
      const nextImages = await Promise.all(
        nextFiles.map(async (file) => ({
          id: crypto.randomUUID(),
          name: file.name || 'image',
          src: file.type === 'image/svg+xml' ? await readFileAsDataUrl(file) : await compressImage(file),
        })),
      )
      setImages((current) => [...current, ...nextImages])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add image')
    } finally {
      setReadingImages(false)
    }
  }

  const handlePaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardFiles = Array.from(event.clipboardData.files)
    if (clipboardFiles.some((file) => file.type.startsWith('image/'))) {
      event.preventDefault()
      await addFiles(clipboardFiles)
    }
  }

  const handleDrop = async (event: DragEvent<HTMLTextAreaElement>) => {
    const droppedFiles = Array.from(event.dataTransfer.files)
    if (droppedFiles.some((file) => file.type.startsWith('image/'))) {
      event.preventDefault()
      await addFiles(droppedFiles)
    }
  }

  return (
    <div className="rounded-2xl border border-black/8 bg-white/80 p-3 shadow-[0_16px_40px_rgba(44,24,12,0.08)] backdrop-blur dark:border-white/10 dark:bg-black/25 lg:rounded-3xl">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="grid gap-3">
          <textarea
            aria-label="Quick capture note"
            placeholder="Type note. Paste or drop images here. Cmd/Ctrl+Enter = save."
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onPaste={(event) => {
              void handlePaste(event)
            }}
            onDrop={(event) => {
              void handleDrop(event)
            }}
            onDragOver={(event) => {
              if (Array.from(event.dataTransfer.types).includes('Files')) {
                event.preventDefault()
              }
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                void save()
              }
            }}
            className="min-h-28 w-full resize-y rounded-2xl border border-input bg-background px-4 py-3 text-base leading-6 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 sm:text-sm"
          />

          {images.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-2"
                >
                  <img
                    alt={image.name}
                    src={image.src}
                    className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{image.name}</p>
                    <p className="text-xs text-muted-foreground">Image attached</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-8 w-8 shrink-0"
                    aria-label={`Remove ${image.name}`}
                    onClick={() => setImages((current) => current.filter((item) => item.id !== image.id))}
                  >
                    <RiCloseLine />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 md:self-end">
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
          <Button
            variant="outline"
            className="h-12 w-full rounded-2xl px-5 md:w-auto"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving || readingImages}
          >
            <RiImageAddLine />
            <span>Images</span>
          </Button>
          <Button
            className="h-12 w-full rounded-2xl px-5 md:w-auto"
            disabled={saving || readingImages || !composeMarkdown(content, images).trim()}
            onClick={() => void save()}
          >
            <RiSave3Line />
            <span>{saving ? 'Saving' : 'Save'}</span>
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Markdown supported. Images paste/drop/upload. Multiple images okay. `Cmd/Ctrl+Enter` saves.
      </p>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
