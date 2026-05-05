import { lazy, Suspense, type ComponentType } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { useTheme } from '@/hooks/use-theme'

type CodeHighlighterProps = {
  language: string
  children: string
  theme: 'light' | 'dark'
}

const LazyCodeHighlighter = lazy(
  () => import('@/components/code-highlighter') as Promise<{ default: ComponentType<CodeHighlighterProps> }>,
)

function createMarkdownComponents(theme: 'light' | 'dark'): Components {
  return {
    h1: ({ children }) => <h1 className="mb-3 text-2xl font-semibold">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-2 text-xl font-semibold">{children}</h2>,
    p: ({ children }) => <p className="mb-3 leading-6 text-foreground last:mb-0">{children}</p>,
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

export function MarkdownRenderer({ content }: { content: string }) {
  const { theme } = useTheme()

  return (
    <ReactMarkdown
      components={createMarkdownComponents(theme)}
      rehypePlugins={[rehypeRaw]}
      remarkPlugins={[remarkBreaks, remarkGfm]}
    >
      {content}
    </ReactMarkdown>
  )
}

export default MarkdownRenderer
