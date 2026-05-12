import { createElement } from 'react'
import type { BlockNoteEditor } from '@blocknote/core'
import { filterSuggestionItems } from '@blocknote/core'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import type { TreeNode } from '../../lib/api'
import { resolveWikiIcon, isRawEmoji } from '../../lib/icons'
import { wikiReferenceHref } from './wikiReferences'

type FlatPage = { path: string; title: string; icon?: string; type: 'page' | 'board' }

function flattenTree(nodes: TreeNode[], out: FlatPage[] = []): FlatPage[] {
  for (const node of nodes) {
    out.push({ path: node.path, title: node.title, icon: node.icon, type: node.type })
    if (node.children?.length) flattenTree(node.children, out)
  }
  return out
}

function pageGlyph(page: FlatPage): string {
  const fallback = page.type === 'board' ? 'board' : 'page'
  const value = page.icon?.trim()
  const resolved = resolveWikiIcon(value || fallback)
  if (resolved?.glyph) return resolved.glyph
  if (isRawEmoji(value)) return value as string
  return resolveWikiIcon(fallback)?.glyph ?? '📄'
}

function insertPageLink(editor: BlockNoteEditor<any, any, any>, page: FlatPage) {
  editor.insertInlineContent([
    { type: 'link', href: wikiReferenceHref(page.path), content: page.title },
    ' ',
  ])
}

export function pagePickerItems(
  editor: BlockNoteEditor<any, any, any>,
  tree: TreeNode[],
  query: string,
): DefaultReactSuggestionItem[] {
  const pages = flattenTree(tree)
  const items = pages.map<DefaultReactSuggestionItem>((page) => ({
    title: page.title,
    subtext: page.path,
    aliases: [page.path, ...page.path.split('/')],
    group: page.type === 'board' ? 'Boards' : 'Pages',
    icon: createElement('span', { className: 'text-base leading-none' }, pageGlyph(page)),
    onItemClick: () => insertPageLink(editor, page),
  }))
  return filterSuggestionItems(items, query)
}
