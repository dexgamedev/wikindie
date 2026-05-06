import { Menu, Search } from 'lucide-react'
import logoUrl from '../../assets/wikindie_logo.png'
import { ThemeToggle } from '../ui/ThemeToggle'
import { AccountMenu } from './AccountMenu'

export function TopBar({ onOpenMobile, onSearchOpen }: { onOpenMobile: () => void; onSearchOpen: () => void }) {
  return (
    <header className="panel flex h-14 shrink-0 items-center justify-between gap-4 px-3 md:h-16 md:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          className="rounded-lg p-2 text-text-muted transition hover:bg-accent/10 hover:text-text md:hidden"
          onClick={onOpenMobile}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <Menu size={17} />
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <img src={logoUrl} alt="" className="block h-9 w-auto shrink-0 md:h-10" />
          <span className="translate-y-0.5 truncate text-xl font-extrabold leading-none tracking-tight text-text md:text-2xl">Wikindie</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          className="flex items-center gap-2 rounded-lg border border-control-border bg-surface-hover px-3 py-2 text-sm text-text-muted transition hover:border-accent hover:bg-control hover:text-text"
          onClick={onSearchOpen}
          title="Search pages"
        >
          <Search size={15} />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-border bg-input px-1.5 py-0.5 text-[10px] text-text-muted md:inline">Ctrl K</kbd>
        </button>
        <ThemeToggle />
        <AccountMenu direction="down" compact />
      </div>
    </header>
  )
}
