import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function PasswordInput({ className = '', disabled, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<{ start: number; end: number; direction: 'forward' | 'backward' | 'none' } | null>(null)
  const Icon = visible ? EyeOff : Eye

  useEffect(() => {
    const selection = selectionRef.current
    const input = inputRef.current
    if (!selection || !input) return

    const restore = () => {
      input.focus()
      input.setSelectionRange(selection.start, selection.end, selection.direction)
    }
    const frame = requestAnimationFrame(restore)
    selectionRef.current = null
    return () => cancelAnimationFrame(frame)
  }, [visible])

  const captureSelection = () => {
    const input = inputRef.current
    if (input && input.selectionStart !== null && input.selectionEnd !== null) {
      selectionRef.current = {
        start: input.selectionStart,
        end: input.selectionEnd,
        direction: input.selectionDirection ?? 'none',
      }
    }
  }

  const toggleVisible = () => {
    if (!selectionRef.current) captureSelection()
    setVisible((value) => !value)
  }

  return (
    <div className={`relative ${className}`}>
      <input
        {...props}
        ref={inputRef}
        disabled={disabled}
        type={visible ? 'text' : 'password'}
        className="w-full rounded-md border border-border bg-input px-3 py-2 pr-10 text-text outline-none transition placeholder:text-text-muted focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-text-muted transition hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={toggleVisible}
        onMouseDown={(event) => {
          captureSelection()
          event.preventDefault()
        }}
        type="button"
      >
        <Icon size={16} />
      </button>
    </div>
  )
}
