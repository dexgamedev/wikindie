import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuthStore, useFilesStore } from '../../lib/store'
import { connectWebSocket } from '../../lib/websocket'
import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const username = useAuthStore((state) => state.username)
  const setTree = useFilesStore((state) => state.setTree)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const refreshTree = () => api.tree().then(({ tree }) => setTree(tree)).catch(console.error)
    refreshTree()
    return connectWebSocket((event) => {
      window.dispatchEvent(new CustomEvent('wikindie:event', { detail: event }))
      if (event.type === 'tree:changed') refreshTree()
    })
  }, [setTree])

  return (
    <div className="min-h-screen bg-slate-950 text-text">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <main className="min-w-0 md:pl-[300px]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm text-text-muted md:hidden">
          <button className="rounded border border-border bg-surface px-2 py-1 text-text" onClick={() => setMobileOpen(true)}>
            <Menu size={16} />
          </button>
          <span>{username}</span>
          <span className="text-xs">Menu</span>
        </div>
        {children}
      </main>
    </div>
  )
}
