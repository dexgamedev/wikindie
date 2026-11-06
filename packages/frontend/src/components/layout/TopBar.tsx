import { Github, Menu, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import logoUrl from '../../assets/wikindie_logo.png'
import { appVersion, githubUrl } from '../../lib/version'
import { ThemeToggle } from '../ui/ThemeToggle'
import { AccountMenu } from './AccountMenu'

export function TopBar({
  onOpenMobile,
  onSearchOpen,
}: {
  onOpenMobile: () => void
  onSearchOpen: () => void
}) {
  return (
    <header className="relative z-10 flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border bg-sidebar pl-1 pr-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        <button
          className="grid size-8 shrink-0 place-items-center rounded-md text-text-muted transition hover:bg-surface-hover hover:text-text lg:hidden"
          onClick={onOpenMobile}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <Menu size={17} />
        </button>
        <Link to="/" className="flex min-w-0 items-center gap-2 rounded-md transition hover:opacity-80">
          <img src={logoUrl} alt="" className="block h-6 w-auto shrink-0" />
          <span className="hidden min-w-0 items-baseline gap-1.5 sm:flex">
            <span className="block truncate text-sm font-semibold leading-none tracking-tight text-text-heading">Wikindie</span>
            <span className="block shrink-0 font-mono text-[10px] leading-none text-text-muted">{appVersion}</span>
          </span>
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <button
          className="grid size-8 shrink-0 place-items-center rounded-md text-text-muted transition hover:bg-surface-hover hover:text-text sm:hidden"
          onClick={onSearchOpen}
          title="Search pages"
          aria-label="Search pages"
          type="button"
        >
          <Search size={15} />
        </button>
        <button
          className="hidden h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm text-text-muted transition hover:bg-surface-hover hover:text-text sm:flex"
          onClick={onSearchOpen}
          title="Search pages"
          type="button"
        >
          <Search size={15} />
          <span>Search</span>
          <kbd className="hidden rounded border border-border bg-input px-1.5 py-0.5 font-mono text-[10px] text-text-muted md:inline">Ctrl K</kbd>
        </button>
        <ThemeToggle />
        <a
          className="grid size-8 shrink-0 place-items-center rounded-md text-text-muted transition hover:bg-surface-hover hover:text-text"
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          title="GitHub repository"
          aria-label="GitHub repository"
        >
          <Github size={16} />
        </a>
        <AccountMenu direction="down" />
      </div>
    </header>
  )
}
