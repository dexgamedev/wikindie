import { LogOut, Moon, Shield, Sun } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { roleBadgeClass } from '../../lib/badges'
import { useAuthStore } from '../../lib/store'

export function AccountMenu({ direction = 'down' }: { direction?: 'up' | 'down' }) {
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

  const { theme, toggle: toggleTheme } = useTheme()
  const ThemeIcon = theme === 'dark' ? Sun : Moon

  const signOut = () => {
    logout()
    navigate('/login')
  }

  const popupPosition = direction === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'

  return (
    <div ref={rootRef} className="relative">
      <button
        className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white transition hover:brightness-110"
        onClick={() => setOpen((value) => !value)}
        title={username ?? 'Account'}
      >
        {initials}
      </button>

      {open && (
        <div className={`absolute ${popupPosition} right-0 z-50 w-[260px] rounded-md border border-border bg-input p-2 shadow-lg shadow-heavy`}>
          <div className="mb-2 flex items-center gap-3 rounded-md bg-surface p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{username ?? 'Account'}</p>
              <span className={`mt-1 inline-flex rounded border px-2 py-0.5 text-xs capitalize ${roleBadgeClass(role)}`}>{role ?? 'unknown'}</span>
            </div>
          </div>

          {role === 'admin' && (
            <button
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-text hover:bg-accent/10"
              onClick={() => {
                setOpen(false)
                navigate('/admin')
              }}
            >
              <Shield size={15} /> Admin Console
            </button>
          )}
          <button
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-text hover:bg-accent/10"
            onClick={toggleTheme}
          >
            <ThemeIcon size={15} /> {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <div className="my-1 border-t border-border" />
          <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-danger hover:bg-danger/10" onClick={signOut}>
            <LogOut size={15} /> Logout
          </button>
        </div>
      )}
    </div>
  )
}
