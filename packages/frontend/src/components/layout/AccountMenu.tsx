import { ChevronDown, ChevronUp, LogOut, Shield } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { roleBadgeClass } from '../../lib/badges'
import { useAuthStore } from '../../lib/store'

export function AccountMenu({ collapsed = false, direction = 'down', compact = false }: { collapsed?: boolean; direction?: 'up' | 'down'; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const username = useAuthStore((state) => state.username)
  const role = useAuthStore((state) => state.role)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  const initials = useMemo(() => {
    const clean = username?.trim() || 'User'
    return clean
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('')
  }, [username])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const signOut = () => {
    logout()
    navigate('/login')
  }

  const labelClass = compact ? 'hidden' : collapsed ? 'md:hidden' : ''
  const popupPosition = direction === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'
  const popupAlign = direction === 'down' || compact ? 'right-0' : 'left-0'
  const popupWidth = compact || collapsed ? 'w-[260px]' : 'w-full'
  const ChevronIcon = direction === 'down' ? ChevronDown : ChevronUp

  return (
    <div ref={rootRef} className="relative">
      <button
        className={`flex w-full items-center rounded-lg py-2 text-left transition hover:bg-accent/10 ${compact ? 'justify-center px-2' : collapsed ? 'gap-3 px-2 md:justify-center md:px-0' : 'gap-3 px-3'}`}
        onClick={() => setOpen((value) => !value)}
        title={compact || collapsed ? username ?? 'Account' : undefined}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-cyan-300 text-sm font-bold text-slate-950">
          {initials}
        </span>
        <span className={`min-w-0 flex-1 ${labelClass}`}>
          <span className="block truncate text-sm font-medium text-text">{username ?? 'Account'}</span>
          <span className="block truncate text-xs capitalize text-text-muted">{role ?? 'signed in'}</span>
        </span>
        <ChevronIcon size={15} className={`text-text-muted transition ${open ? 'rotate-180' : ''} ${labelClass}`} />
      </button>

      {open && (
        <div className={`absolute ${popupPosition} ${popupAlign} z-50 rounded-lg border border-border bg-input p-2 shadow-2xl ${popupWidth}`}>
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-surface p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-cyan-300 text-sm font-bold text-slate-950">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{username ?? 'Account'}</p>
              <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs capitalize ${roleBadgeClass(role)}`}>{role ?? 'unknown'}</span>
            </div>
          </div>

          {role === 'admin' && (
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-accent/10"
              onClick={() => {
                setOpen(false)
                navigate('/admin')
              }}
            >
              <Shield size={15} /> Admin Console
            </button>
          )}
          <div className="my-1 border-t border-border" />
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/10" onClick={signOut}>
            <LogOut size={15} /> Logout
          </button>
        </div>
      )}
    </div>
  )
}
