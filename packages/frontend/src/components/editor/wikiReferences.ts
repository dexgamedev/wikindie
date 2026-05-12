import { pagePathFromLocation, pageUrl } from '../../lib/paths'

const WIKI_REFERENCE_HASH = 'wikindie-ref'

function escapeMarkdownLinkText(value: string) {
  return value.replace(/[\\[\]]/g, '\\$&')
}

function unescapeMarkdownLinkText(value: string) {
  return value.replace(/\\([\\[\]])/g, '$1')
}

export function wikiReferenceHref(path: string) {
  return `${pageUrl(path).replace(/[()]/g, (char) => (char === '(' ? '%28' : '%29'))}#${WIKI_REFERENCE_HASH}`
}

function protectedReferenceFor(value: string) {
  const [rawPath, ...rawLabel] = value.split('|')
  const path = rawPath.trim()
  if (!path) return `[[${value}]]`
  const label = rawLabel.length ? rawLabel.join('|').trim() || path : path
  return `[${escapeMarkdownLinkText(label)}](${wikiReferenceHref(path)})`
}

function protectReferencesInLine(line: string) {
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
        result += protectedReferenceFor(line.slice(index + 2, end))
        index = end + 2
        continue
      }
    }

    result += line[index]
    index++
  }

  return result
}

export function protectWikiReferences(value: string) {
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
    return protectReferencesInLine(line)
  }).join('\n')
}

function restoredReferenceFor(label: string, href: string, fallback: string) {
  const normalizedHref = href.startsWith('<') && href.endsWith('>') ? href.slice(1, -1) : href
  try {
    const url = new URL(normalizedHref, window.location.origin)
    if (url.origin !== window.location.origin || url.hash !== `#${WIKI_REFERENCE_HASH}`) return fallback
    const path = pagePathFromLocation(url.pathname)
    if (!path) return fallback
    const labelText = unescapeMarkdownLinkText(label).trim()
    return labelText && labelText !== path ? `[[${path}|${labelText}]]` : `[[${path}]]`
  } catch {
    return fallback
  }
}

export function restoreProtectedWikiReferences(value: string) {
  return value.replace(/\[((?:\\.|[^\\\]\n])*)\]\(([^)\n]+)\)/g, (match, label: string, href: string) => restoredReferenceFor(label, href, match))
}
