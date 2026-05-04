import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TreeNode } from '../../lib/api'
import { pageUrl } from '../../lib/paths'
import { useFilesStore } from '../../lib/store'
import { PageIcon } from '../ui/PageIcon'

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const list: TreeNode[] = []
  const walk = (items: TreeNode[]) => {
    for (const item of items) {
      list.push(item)
      if (item.children?.length) walk(item.children)
    }
  }
  walk(nodes)
  return list
}

export function QuickFindModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tree = useFilesStore((state) => state.tree)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const allNodes = useMemo(() => flattenTree(tree), [tree])
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return allNodes.slice(0, 30)
    return allNodes.filter((node) => `${node.title} ${node.path} ${node.icon ?? ''}`.toLowerCase().includes(term)).slice(0, 30)
  }, [allNodes, query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-overlay p-3 md:place-items-center" onClick={onClose}>
      <div className="mt-10 w-full max-w-xl rounded-lg border border-border bg-input p-3 shadow-2xl md:mt-0" onClick={(event) => event.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <Search size={16} className="text-text-muted" />
          <input
            autoFocus
            className="w-full bg-transparent text-sm text-text outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
            }}
            placeholder="Quick find pages and boards"
          />
        </div>
        <div className="max-h-[60vh] overflow-auto">
          {filtered.map((node) => (
            <button
              key={node.path}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-muted hover:bg-accent/10 hover:text-text"
              onClick={() => {
                navigate(pageUrl(node.path))
                onClose()
              }}
            >
              <PageIcon icon={node.icon} fallback={node.type === 'board' ? 'board' : 'page'} />
              <span className="font-medium text-text">{node.title}</span>
              <span className="min-w-0 truncate text-xs text-text-muted">{node.path}</span>
            </button>
          ))}
          {!filtered.length && <p className="px-2 py-4 text-sm text-text-muted">No results.</p>}
        </div>
      </div>
    </div>
  )
}
