import * as React from 'react'
import { createPortal } from 'react-dom'

type DialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function Dialog({ open, onOpenChange, children }: React.PropsWithChildren<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>) {
  return <DialogContext.Provider value={{ open, setOpen: onOpenChange }}>{children}</DialogContext.Provider>
}

function useDialog() {
  const value = React.useContext(DialogContext)
  if (!value) {
    throw new Error('Dialog components must be used inside Dialog')
  }

  return value
}

function DialogTrigger({ children }: React.PropsWithChildren) {
  const { setOpen } = useDialog()
  return (
    <button type="button" onClick={() => setOpen(true)}>
      {children}
    </button>
  )
}

function DialogContent({
  children,
  className = '',
}: React.PropsWithChildren<{
  className?: string
}>) {
  const { open, setOpen } = useDialog()
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const lastActiveElement = React.useRef<HTMLElement | null>(null)
  const setOpenRef = React.useRef(setOpen)

  React.useEffect(() => {
    setOpenRef.current = setOpen
  }, [setOpen])

  React.useEffect(() => {
    if (!open) return

    lastActiveElement.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenRef.current(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    queueMicrotask(() => {
      const focusable = contentRef.current?.querySelector<HTMLElement>(
        '[data-autofocus], textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )
      focusable?.focus()
    })

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      lastActiveElement.current?.focus?.()
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onMouseDown={() => setOpenRef.current(false)}
    >
      <div
        ref={contentRef}
        className={[
          'relative w-full rounded-3xl border border-border bg-background p-5 shadow-2xl',
          className,
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-4 top-4 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          onClick={() => setOpenRef.current(false)}
          aria-label="Close dialog"
        >
          ×
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function DialogHeader({ children }: React.PropsWithChildren) {
  return <div className="mb-3 space-y-1 pr-8">{children}</div>
}

function DialogTitle({ children }: React.PropsWithChildren) {
  return <h2 className="font-heading text-lg font-semibold">{children}</h2>
}

function DialogDescription({ children }: React.PropsWithChildren) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function DialogFooter({ children }: React.PropsWithChildren) {
  return <div className="mt-5 flex justify-end gap-2">{children}</div>
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
}
