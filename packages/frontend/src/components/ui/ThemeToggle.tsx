import { Moon, Sun } from 'lucide-react'
import { useRef } from 'react'
import { useTheme } from '../../hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const handledPointerRef = useRef(false)
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const Icon = theme === 'dark' ? Sun : Moon

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    event.preventDefault()
    handledPointerRef.current = true
    toggle()
  }

  const handleClick = () => {
    if (handledPointerRef.current) {
      handledPointerRef.current = false
      return
    }
    toggle()
  }

  return (
    <button
      className="relative z-20 grid size-8 shrink-0 touch-manipulation place-items-center rounded-md bg-transparent text-text-muted transition hover:bg-surface-hover hover:text-text"
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${nextTheme} theme`}
      aria-label={`Switch to ${nextTheme} theme`}
      type="button"
    >
      <Icon size={16} />
    </button>
  )
}
