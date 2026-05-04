import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const Icon = theme === 'dark' ? Sun : Moon

  return (
    <button
      className="grid size-10 place-items-center rounded-lg text-text-muted transition hover:bg-accent/10 hover:text-text"
      onClick={toggle}
      title={`Switch to ${nextTheme} theme`}
      aria-label={`Switch to ${nextTheme} theme`}
      type="button"
    >
      <Icon size={16} />
    </button>
  )
}
