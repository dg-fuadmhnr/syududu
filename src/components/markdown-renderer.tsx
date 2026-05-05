import { lazy, Suspense, useState, type ComponentType } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useTheme } from '@/hooks/use-theme'

type CodeHighlighterProps = {
  language: string
  children: string
  theme: 'light' | 'dark'
}

const LazyCodeHighlighter = lazy(
  () => import('@/components/code-highlighter') as Promise<{ default: ComponentType<CodeHighlighterProps> }>,
)

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [open, setOpen] = useState(false)
  const resolvedSrc = src ?? ''
  const label = alt ?? 'Image'

  return (
    <>
      <button
        type="button"
        className="my-3 block w-full overflow-hidden rounded-2xl border border-black/5 bg-muted/30 text-left dark:border-white/10"
        onClick={() => setOpen(true)}
      >
        <img
          alt={label}
          src={resolvedSrc}
          className="max-h-72 w-full object-cover sm:max-h-80"
          loading="lazy"
          decoding="async"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[96vw] p-3 sm:max-w-5xl sm:p-4">
          <div className="flex max-h-[88dvh] items-center justify-center overflow-auto">
            <img
              alt={label}
              src={resolvedSrc}
              className="max-h-[84dvh] w-auto max-w-full rounded-2xl object-contain"
              loading="eager"
              decoding="async"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function createMarkdownComponents(theme: 'light' | 'dark'): Components {
  return {
    h1: ({ children }) => <h1 className="mb-3 text-2xl font-semibold">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-2 text-xl font-semibold">{children}</h2>,
    p: ({ children }) => <p className="mb-3 leading-6 text-foreground last:mb-0">{children}</p>,
    img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />,
    ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
    li: ({ children }) => <li className="leading-6">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="mb-3 border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
        {children}
      </blockquote>
    ),
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className ?? '')
      const code = String(children).replace(/\n$/, '')

      if (match) {
        return (
          <Suspense
            fallback={
              <pre className="overflow-x-auto rounded-xl bg-muted px-4 py-3 text-sm leading-6">
                {code}
              </pre>
            }
          >
            <LazyCodeHighlighter theme={theme} language={match[1]}>
              {code}
            </LazyCodeHighlighter>
          </Suspense>
        )
      }

      return (
        <code
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
          {...props}
        >
          {children}
        </code>
      )
    },
  }
}

function allowImageDataUrls(url: string) {
  if (url.startsWith('data:image/')) {
    return url
  }

  return defaultUrlTransform(url)
}

export function MarkdownRenderer({ content }: { content: string }) {
  const { theme } = useTheme()

  return (
    <ReactMarkdown
      components={createMarkdownComponents(theme)}
      rehypePlugins={[rehypeRaw]}
      remarkPlugins={[remarkBreaks, remarkGfm]}
      urlTransform={allowImageDataUrls}
    >
      {content}
    </ReactMarkdown>
  )
}

export default MarkdownRenderer
