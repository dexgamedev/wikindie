import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api, isAttachmentUrl } from '../../lib/api'
import { resolveAttachmentObjectUrl } from '../../lib/attachmentCache'
import { parseImageWidth } from './imageWidths'
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
    // not a parseable URL, fall through
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

function filenameFromUrl(url: string) {
  try {
    const parts = new URL(url, window.location.origin).pathname.split('/').filter(Boolean)
    return decodeURIComponent(parts[parts.length - 1] ?? 'attachment')
  } catch {
    return 'attachment'
  }
}

function AttachmentImage({ src = '', alt = '', style, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const { src: cleanSrc, width } = parseImageWidth(src)
  const isAttachment = Boolean(cleanSrc) && isAttachmentUrl(cleanSrc)
  // Never render the raw attachment URL: an <img> cannot send the bearer token,
  // so it would 401. Resolve through the authenticated shared cache first.
  const [resolvedSrc, setResolvedSrc] = useState(isAttachment ? '' : cleanSrc)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!isAttachment) {
      setResolvedSrc(cleanSrc)
      setFailed(false)
      return
    }

    let cancelled = false
    setResolvedSrc('')
    setFailed(false)
    resolveAttachmentObjectUrl(cleanSrc)
      .then((objectUrl) => { if (!cancelled) setResolvedSrc(objectUrl) })
      .catch(() => { if (!cancelled) setFailed(true) })

    return () => { cancelled = true }
  }, [cleanSrc, isAttachment])

  const sizeStyle = width ? { width, maxWidth: '100%', ...style } : style

  if (failed) {
    return <span className="inline-block rounded border border-border bg-surface px-2 py-1 text-xs text-text-muted">Image unavailable{alt ? `: ${alt}` : ''}</span>
  }
  if (!resolvedSrc) {
    return <span className="inline-block h-24 w-40 max-w-full animate-pulse rounded bg-border/40 align-middle" style={width ? { width, height: undefined } : undefined} aria-label={alt || 'Loading image'} />
  }
  return <img src={resolvedSrc} alt={alt} style={sizeStyle} {...props} />
}

function AttachmentLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handleClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const objectUrl = URL.createObjectURL(await api.attachmentBlob(href))
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filenameFromUrl(href)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }

  return <a href={href} onClick={handleClick} {...props}>{children}</a>
}

export function MarkdownPreview({
  content,
  compact = false,
  frameless = false,
}: {
  content: string
  compact?: boolean
  frameless?: boolean
}) {
  return (
    <article className={`markdown-preview ${compact ? 'markdown-preview-compact text-sm' : ''} text-text ${frameless ? '' : 'rounded-md border border-border bg-surface p-5'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = '', children, ...props }) => {
            const internal = internalPathFor(href)
            if (internal) return <Link to={internal}>{children}</Link>
            if (isAttachmentUrl(href)) return <AttachmentLink href={href} {...props}>{children}</AttachmentLink>
            if (isExternalUrl(href)) return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>
            return <a href={href} {...props}>{children}</a>
          },
          img: ({ src = '', alt = '', ...props }) => <AttachmentImage src={src} alt={alt} {...props} />,
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
