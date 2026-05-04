import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../../lib/api'
import { pagePathFromLocation } from '../../lib/paths'
import { useFilesStore } from '../../lib/store'
import { connectWebSocket } from '../../lib/websocket'
import { QuickFindModal } from './QuickFindModal'
import { Sidebar } from './Sidebar'
import { TaskPanel } from './TaskPanel'
import { TopBar } from './TopBar'

const sidebarCollapsedKey = 'wikindie:sidebar-collapsed'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const setTree = useFilesStore((state) => state.setTree)
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [quickFindOpen, setQuickFindOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(sidebarCollapsedKey) === 'true')
  const pagePath = useMemo(() => pagePathFromLocation(location.pathname), [location.pathname])

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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setQuickFindOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const closeQuickFind = () => {
    setQuickFindOpen(false)
    setMobileOpen(false)
  }

  return (
    <div className="flex h-dvh flex-col gap-2 bg-slate-950 p-2 text-text">
      <TopBar onOpenMobile={() => setMobileOpen(true)} onSearchOpen={() => setQuickFindOpen(true)} />
      <QuickFindModal open={quickFindOpen} onClose={closeQuickFind} />
      <div className="flex min-h-0 flex-1 gap-2">
        <Sidebar
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
        <main className="panel workspace-scroll min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
        <TaskPanel pagePath={pagePath} />
      </div>
    </div>
  )
}
