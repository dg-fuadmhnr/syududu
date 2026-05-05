export type InlineImage = {
  name: string
  src: string
}

export type NoteAttachmentInput = {
  name: string
  mimeType: string
  dataUrl: string
  sortOrder: number
}

export type DraftAttachment = NoteAttachmentInput & {
  id: string
}

const INLINE_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g

export function extractInlineImages(content: string) {
  const images = Array.from(content.matchAll(INLINE_IMAGE_RE))
    .map((match) => ({
      name: match[1] || 'image',
      src: match[2],
    }))
    .filter((image) => image.src.startsWith('data:image/'))

  const body = content.replace(INLINE_IMAGE_RE, '').replace(/\n{3,}/g, '\n\n').trim()

  return { body, images }
}

export function mimeTypeFromDataUrl(dataUrl: string) {
  if (dataUrl.startsWith('data:image/png')) return 'image/png'
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'image/jpeg'
  if (dataUrl.startsWith('data:image/webp')) return 'image/webp'
  if (dataUrl.startsWith('data:image/svg+xml')) return 'image/svg+xml'
  return 'image/*'
}
