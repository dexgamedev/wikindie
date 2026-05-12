import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { filterSuggestionItems } from '@blocknote/core'
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { Link2 } from 'lucide-react'
import '@blocknote/shadcn/style.css'
import './blocknote.css'
import { useFilesStore } from '../../lib/store'
import { pagePickerItems } from './pagePicker'
import { protectWikiReferences, restoreProtectedWikiReferences } from './wikiReferences'

const HIDDEN_SLASH_ITEMS = new Set(['Audio', 'Video', 'File'])

const ALLOWED_LINK_PROTOCOL = /^(https?|ftp|ftps|mailto|tel|callto|sms|cid|xmpp):/i

function isValidWikindieLink(href: string | undefined) {
  if (!href) return false
  if (href.startsWith('/')) return true
  if (href.startsWith('#')) return true
  return ALLOWED_LINK_PROTOCOL.test(href)
}

type Props = {
  value: string
  onChange: (markdown: string) => void
  editable?: boolean
  className?: string
}

export function BlockEditor({ value, onChange, editable = true, className }: Props) {
  const editor = useCreateBlockNote({
    links: { isValidLink: isValidWikindieLink },
  })
  const navigate = useNavigate()
  const tree = useFilesStore((state) => state.tree)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const lastEmittedMd = useRef<string>(value)
  const isReseeding = useRef(false)
  const seeded = useRef(false)

  useEffect(() => {
    if (seeded.current && value === lastEmittedMd.current) return
    seeded.current = true
    const parsed = editor.tryParseMarkdownToBlocks(protectWikiReferences(value))
    const blocks = parsed.length ? parsed : [{ type: 'paragraph' as const }]
    isReseeding.current = true
    editor.replaceBlocks(editor.document, blocks)
    lastEmittedMd.current = value
    queueMicrotask(() => {
      isReseeding.current = false
    })
  }, [editor, value])

  const handleChange = useCallback(() => {
    if (isReseeding.current) return
    const md = restoreProtectedWikiReferences(editor.blocksToMarkdownLossy(editor.document))
    if (md === lastEmittedMd.current) return
    lastEmittedMd.current = md
    onChange(md)
  }, [editor, onChange])

  useEffect(() => {
    const root = wrapperRef.current
    if (!root) return

    const handler = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0 && event.button !== 1) return
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      if (!href.startsWith('/')) return
      if (editable) {
        const wantsNavigation = event.button === 1 || event.ctrlKey || event.metaKey || event.shiftKey
        if (!wantsNavigation) return
      }
      event.preventDefault()
      event.stopPropagation()
      navigate(href)
    }

    root.addEventListener('click', handler, true)
    root.addEventListener('auxclick', handler, true)
    return () => {
      root.removeEventListener('click', handler, true)
      root.removeEventListener('auxclick', handler, true)
    }
  }, [navigate, editable])

  return (
    <div ref={wrapperRef} className={className}>
      <BlockNoteView
        editor={editor}
        editable={editable}
        onChange={handleChange}
        slashMenu={false}
        filePanel={false}
        data-wikindie-editor=""
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            const pageLink: DefaultReactSuggestionItem = {
              title: 'Page link',
              subtext: 'Insert a link to another page',
              aliases: ['page', 'wiki', 'link', 'ref'],
              group: 'Insert',
              icon: <Link2 size={16} />,
              onItemClick: () => {
                const ext = editor.getExtension('suggestionMenu') as
                  | { openSuggestionMenu?: (trigger: string, opts?: { deleteTriggerCharacter?: boolean }) => void }
                  | undefined
                ext?.openSuggestionMenu?.('[[', { deleteTriggerCharacter: false })
              },
            }
            return filterSuggestionItems(
              [
                pageLink,
                ...getDefaultReactSlashMenuItems(editor).filter((item) => !HIDDEN_SLASH_ITEMS.has(item.title)),
              ],
              query,
            )
          }}
        />
        <SuggestionMenuController
          triggerCharacter="[["
          getItems={async (query) => pagePickerItems(editor, tree, query)}
        />
      </BlockNoteView>
    </div>
  )
}
