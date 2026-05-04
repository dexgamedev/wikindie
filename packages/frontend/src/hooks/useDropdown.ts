import { useEffect, useRef, useState, type RefObject } from 'react'

export function useDropdown<T extends HTMLElement = HTMLDivElement>(): {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  ref: RefObject<T | null>
} {
  const [open, setOpen] = useState(false)
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (ref.current?.contains(event.target)) return
      setOpen(false)
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

  return { open, setOpen, ref }
}
