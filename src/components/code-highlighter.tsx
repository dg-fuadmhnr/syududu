import type { ComponentType, CSSProperties } from 'react'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import darkTheme from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus'
import lightTheme from 'react-syntax-highlighter/dist/esm/styles/prism/one-light'

type HighlighterProps = {
  language?: string
  PreTag?: 'div'
  style?: Record<string, CSSProperties>
  customStyle?: CSSProperties
  children?: string
  theme?: 'light' | 'dark'
}

type PrismLightComponent = ComponentType<HighlighterProps> & {
  registerLanguage: (name: string, language: unknown) => void
}

const CodeHighlighter = SyntaxHighlighter as unknown as PrismLightComponent

CodeHighlighter.registerLanguage('tsx', tsx)
CodeHighlighter.registerLanguage('ts', typescript)
CodeHighlighter.registerLanguage('typescript', typescript)
CodeHighlighter.registerLanguage('jsx', javascript)
CodeHighlighter.registerLanguage('js', javascript)
CodeHighlighter.registerLanguage('javascript', javascript)
CodeHighlighter.registerLanguage('bash', bash)
CodeHighlighter.registerLanguage('sh', bash)
CodeHighlighter.registerLanguage('json', json)

export function CodeHighlighterBlock({ language, children, theme = 'light' }: HighlighterProps) {
  const themeStyles = theme === 'dark' ? darkTheme : lightTheme

  return (
    <CodeHighlighter
      language={language}
      PreTag="div"
      style={themeStyles}
      customStyle={{
        margin: 0,
        borderRadius: '1rem',
        padding: '1rem',
        fontSize: '0.875rem',
        lineHeight: 1.6,
      }}
    >
      {children}
    </CodeHighlighter>
  )
}

export default CodeHighlighterBlock
