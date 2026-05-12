import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { renderIconShortcodes } from '../../lib/icons'
import { pageUrl } from '../../lib/paths'

function isExternalUrl(href: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')
}

function internalPathFor(href: string): string | null {
  if (!href) return null
  if (href.startsWith('/page/')) return href
  try {
    const url = new URL(href, window.location.origin)
    if (url.origin === window.location.origin && url.pathname.startsWith('/page/')) {
      return url.pathname + url.search + url.hash
    }
  } catch {
    // not a parseable URL — fall through
  }
  // Malformed protocol-only forms (e.g. "https:///page/Foo") can come from
  // typed paths that are missing a recognised scheme. Do not match real hosts.
  const malformedProtocolPath = href.match(/^[a-z][a-z0-9+.-]*:\/\/(\/page\/.*)$/i)
  if (malformedProtocolPath) return malformedProtocolPath[1]
  return null
}

function escapeMarkdownLinkText(value: string) {
  return value.replace(/[\\[\]]/g, '\\$&')
}

function renderPageReference(value: string) {
  const [rawPath, ...rawLabel] = value.split('|')
  const path = rawPath.trim()
  if (!path) return `[[${value}]]`
  const label = rawLabel.length ? rawLabel.join('|').trim() || path : path
  return `[${escapeMarkdownLinkText(label)}](${pageUrl(path)})`
}

function renderReferencesInLine(line: string) {
  let result = ''
  let index = 0

  while (index < line.length) {
    if (line[index] === '`') {
      const tickStart = index
      while (index < line.length && line[index] === '`') index++
      const ticks = line.slice(tickStart, index)
      const codeEnd = line.indexOf(ticks, index)
      if (codeEnd < 0) return result + line.slice(tickStart)
      result += line.slice(tickStart, codeEnd + ticks.length)
      index = codeEnd + ticks.length
      continue
    }

    if (line.startsWith('[[', index)) {
      const end = line.indexOf(']]', index + 2)
      if (end >= 0) {
        result += renderPageReference(line.slice(index + 2, end))
        index = end + 2
        continue
      }
    }

    result += line[index]
    index++
  }

  return result
}

function renderPageReferences(value: string) {
  let fenced = false
  let fenceMarker = ''

  return value.split('\n').map((line) => {
    const fence = line.match(/^\s*(`{3,}|~{3,})/)
    if (fence && (!fenced || fence[1][0] === fenceMarker[0])) {
      fenced = !fenced
      fenceMarker = fenced ? fence[1] : ''
      return line
    }
    if (fenced) return line
    return renderReferencesInLine(line)
  }).join('\n')
}

export function MarkdownPreview({ content, frameless = false }: { content: string; frameless?: boolean }) {
  return (
    <article className={`markdown-preview text-text ${frameless ? '' : 'rounded-md border border-border bg-surface p-5'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = '', children, ...props }) => {
            const internal = internalPathFor(href)
            if (internal) return <Link to={internal}>{children}</Link>
            if (isExternalUrl(href)) return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>
            return <a href={href} {...props}>{children}</a>
          },
          table: ({ children, ...props }) => (
            <div className="markdown-table-scroll">
              <table {...props}>{children}</table>
            </div>
          ),
        }}
      >
        {renderPageReferences(renderIconShortcodes(content))}
      </ReactMarkdown>
    </article>
  )
}
