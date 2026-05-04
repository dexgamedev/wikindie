import { Menu, Search } from 'lucide-react'
import { AccountMenu } from './AccountMenu'

export function TopBar({ onOpenMobile, onSearchOpen }: { onOpenMobile: () => void; onSearchOpen: () => void }) {
  return (
    <header className="panel flex h-14 shrink-0 items-center justify-between gap-3 px-3 md:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          className="rounded-lg border border-border bg-surface px-2 py-2 text-text-muted transition hover:border-accent hover:text-text md:hidden"
          onClick={onOpenMobile}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <Menu size={17} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-text">Wikindie</h1>
          <p className="hidden truncate text-xs text-text-muted sm:block">Dark workspace for notes, boards, and builds</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          className="flex items-center gap-2 rounded-xl border border-border bg-surface/70 px-3 py-2 text-sm text-text-muted transition hover:border-accent hover:bg-surface-hover hover:text-text"
          onClick={onSearchOpen}
          title="Search pages"
        >
          <Search size={15} />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-border bg-slate-950 px-1.5 py-0.5 text-[10px] text-text-muted md:inline">Ctrl K</kbd>
        </button>
        <AccountMenu direction="down" compact />
      </div>
    </header>
  )
}
