import { useState } from 'react'
import { RiSave3Line } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/hooks/use-app-store'

export function QuickInputBar() {
  const { createNote } = useAppStore()
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!content.trim()) return

    setSaving(true)
    await createNote(content)
    setContent('')
    setSaving(false)
  }

  return (
    <div className="rounded-2xl border border-black/8 bg-white/80 p-3 shadow-[0_16px_40px_rgba(44,24,12,0.08)] backdrop-blur dark:border-white/10 dark:bg-black/25 lg:rounded-3xl">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <textarea
          aria-label="Quick capture note"
          placeholder="Type note. Enter = new line. Cmd/Ctrl+Enter = save."
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              void save()
            }
          }}
          className="min-h-28 w-full resize-y rounded-2xl border border-input bg-background px-4 py-3 text-base leading-6 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 sm:text-sm"
        />
        <Button className="h-12 w-full rounded-2xl px-5 md:w-auto md:self-end" disabled={saving || !content.trim()} onClick={() => void save()}>
          <RiSave3Line />
          <span>Save</span>
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Markdown supported. `Cmd/Ctrl+Enter` saves. Stored in Dexie first.
      </p>
    </div>
  )
}
