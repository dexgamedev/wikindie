import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { renderIconShortcodes } from '../../lib/icons'

function isExternalUrl(href: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')
}

export function MarkdownPreview({ content, frameless = false }: { content: string; frameless?: boolean }) {
  return (
    <article className={`markdown-preview text-text ${frameless ? '' : 'rounded-md border border-border bg-surface p-5'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = '', children, ...props }) => {
            if (href.startsWith('/page/')) return <Link to={href}>{children}</Link>
            if (isExternalUrl(href)) return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>
            return <a href={href} {...props}>{children}</a>
          },
        }}
      >
        {renderIconShortcodes(content)}
      </ReactMarkdown>
    </article>
  )
}
