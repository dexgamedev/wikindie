import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useFilesStore } from '../../lib/store'
import { connectWebSocket } from '../../lib/websocket'
import { Sidebar } from './Sidebar'

const sidebarCollapsedKey = 'wikindie:sidebar-collapsed'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const setTree = useFilesStore((state) => state.setTree)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(sidebarCollapsedKey) === 'true')

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed
      localStorage.setItem(sidebarCollapsedKey, String(next))
      return next
    })
  }

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
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebarCollapsed} />
      <main className={`min-w-0 transition-[padding] duration-200 ${sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-[300px]'}`}>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border px-4 py-3 text-sm text-text-muted md:hidden">
          <button className="rounded border border-border bg-surface px-2 py-1 text-text" onClick={() => setMobileOpen(true)}>
            <Menu size={16} />
          </button>
          <span className="text-center font-semibold text-text">Wikindie</span>
          <span className="w-[34px]" aria-hidden="true" />
        </div>
        {children}
      </main>
    </div>
  )
}
