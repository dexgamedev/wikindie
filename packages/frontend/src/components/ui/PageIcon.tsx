import { isRawEmoji, resolveWikiIcon } from '../../lib/icons'

export function PageIcon({ icon, fallback = 'page', className = '' }: { icon?: string; fallback?: string; className?: string }) {
  const value = icon?.trim()
  const resolved = resolveWikiIcon(value || fallback)
  const glyph = resolved?.glyph ?? (isRawEmoji(value) ? value : resolveWikiIcon(fallback)?.glyph ?? '📄')
  return <span className={`inline-flex items-center justify-center leading-none ${className}`} aria-hidden="true">{glyph}</span>
}
