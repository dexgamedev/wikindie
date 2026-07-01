// BlockNote stores a resized image's width in the image block's `previewWidth`
// prop, which `blocksToMarkdownLossy` drops. To keep the Markdown preview in
// sync with the editor we encode the width into the image URL as a `#w=NNN`
// fragment on serialize, and decode it back into `previewWidth` on parse.
// Un-resized images have `previewWidth: undefined`, so normal Markdown stays
// clean and existing pages are unaffected.

type EditorBlockLike = {
  type?: string
  props?: Record<string, unknown>
  children?: EditorBlockLike[]
}

const WIDTH_FRAGMENT = /^(.*)#w=(\d+)$/

export function parseImageWidth(src: string): { src: string; width?: number } {
  const match = src.match(WIDTH_FRAGMENT)
  if (!match) return { src }
  return { src: match[1], width: Number(match[2]) }
}

function withWidthFragment(url: string, width: number): string {
  const base = url.replace(/#w=\d+$/, '')
  return `${base}#w=${Math.round(width)}`
}

export function collectImageWidths(blocks: EditorBlockLike[], out = new Map<string, number>()): Map<string, number> {
  for (const block of blocks) {
    if (block.type === 'image') {
      const { previewWidth, url } = block.props ?? {}
      if (typeof previewWidth === 'number' && typeof url === 'string' && url) out.set(url, previewWidth)
    }
    if (block.children?.length) collectImageWidths(block.children, out)
  }
  return out
}

export function applyImageWidths(markdown: string, widths: Map<string, number>): string {
  if (!widths.size) return markdown
  return markdown.replace(/(!\[[^\]]*\]\()([^)\s]+)(\))/g, (match, pre: string, url: string, post: string) => {
    const width = widths.get(url)
    return width ? `${pre}${withWidthFragment(url, width)}${post}` : match
  })
}

export function restoreImageWidths(blocks: EditorBlockLike[]): void {
  for (const block of blocks) {
    if (block.type === 'image' && block.props && typeof block.props.url === 'string') {
      const { src, width } = parseImageWidth(block.props.url)
      if (width !== undefined) {
        block.props.url = src
        block.props.previewWidth = width
      }
    }
    if (block.children?.length) restoreImageWidths(block.children)
  }
}
