declare module 'react-syntax-highlighter' {
  import type { ComponentType, CSSProperties, ReactNode } from 'react'

  export const PrismLight: ComponentType<{
    language?: string
    PreTag?: 'div'
    customStyle?: CSSProperties
    children?: ReactNode
    registerLanguage?: (name: string, language: unknown) => void
  }>
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/tsx' {
  const language: unknown
  export default language
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/typescript' {
  const language: unknown
  export default language
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/javascript' {
  const language: unknown
  export default language
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/bash' {
  const language: unknown
  export default language
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/json' {
  const language: unknown
  export default language
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus' {
  const style: Record<string, import('react').CSSProperties>
  export default style
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism/one-light' {
  const style: Record<string, import('react').CSSProperties>
  export default style
}
