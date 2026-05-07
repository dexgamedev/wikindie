import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../../lib/api'
import { pagePathFromLocation } from '../../lib/paths'
import { useFilesStore } from '../../lib/store'
import { connectWebSocket } from '../../lib/websocket'
import { QuickFindModal } from './QuickFindModal'
import { Sidebar } from './Sidebar'
import { TaskPanel } from './TaskPanel'
import { TopBar } from './TopBar'

const MobileTaskPanelContext = createContext<{ openTasks: () => void }>({ openTasks: () => {} })

export function useMobileTaskPanel() {
  return useContext(MobileTaskPanelContext)
}

const sidebarCollapsedKey = 'wikindie:sidebar-collapsed'
const taskPanelCollapsedKey = 'wikindie:task-panel-collapsed'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const setTree = useFilesStore((state) => state.setTree)
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileTaskPanelOpen, setMobileTaskPanelOpen] = useState(false)
  const [quickFindOpen, setQuickFindOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(sidebarCollapsedKey) === 'true')
  const [taskPanelCollapsed, setTaskPanelCollapsed] = useState(() => localStorage.getItem(taskPanelCollapsedKey) === 'true')
  const pagePath = useMemo(() => pagePathFromLocation(location.pathname), [location.pathname])

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed
      localStorage.setItem(sidebarCollapsedKey, String(next))
      return next
    })
  }

  const toggleTaskPanelCollapsed = () => {
    setTaskPanelCollapsed((collapsed) => {
      const next = !collapsed
      localStorage.setItem(taskPanelCollapsedKey, String(next))
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
    setMobileTaskPanelOpen(false)
  }

  useEffect(() => {
    setMobileOpen(false)
    setMobileTaskPanelOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-dvh flex-col gap-3 bg-body p-3 text-text md:p-4">
      <TopBar onOpenMobile={() => setMobileOpen(true)} onSearchOpen={() => setQuickFindOpen(true)} />
      <QuickFindModal open={quickFindOpen} onClose={closeQuickFind} />
      <MobileTaskPanelContext.Provider value={{ openTasks: () => setMobileTaskPanelOpen(true) }}>
        <div className="flex min-h-0 flex-1 gap-3">
          <Sidebar
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={toggleSidebarCollapsed}
          />
          <main className="panel min-w-0 flex-1 overflow-hidden">
            {children}
          </main>
          <TaskPanel
            collapsed={taskPanelCollapsed}
            mobileOpen={mobileTaskPanelOpen}
            onCloseMobile={() => setMobileTaskPanelOpen(false)}
            onToggleCollapsed={toggleTaskPanelCollapsed}
            pagePath={pagePath}
          />
        </div>
      </MobileTaskPanelContext.Provider>
    </div>
  )
}
