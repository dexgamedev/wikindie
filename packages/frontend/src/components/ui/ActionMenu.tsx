import { MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const actionMenuOpenEvent = 'wikindie:action-menu-open'

type MenuPosition = {
  left: number
  top: number
  maxHeight: number
}

function menuPosition(button: HTMLElement, menu: HTMLElement, align: 'start' | 'end'): MenuPosition {
  const buttonRect = button.getBoundingClientRect()
  const gap = 8
  const padding = 8
  const menuWidth = Math.min(menu.offsetWidth, window.innerWidth - padding * 2)
  const naturalHeight = Math.min(menu.scrollHeight, window.innerHeight - padding * 2)
  const belowSpace = window.innerHeight - buttonRect.bottom - gap - padding
  const aboveSpace = buttonRect.top - gap - padding
  const openBelow = belowSpace >= naturalHeight || belowSpace >= aboveSpace
  const availableHeight = Math.max(80, openBelow ? belowSpace : aboveSpace)
  const maxHeight = Math.min(naturalHeight, availableHeight)
  const unclampedLeft = align === 'start' ? buttonRect.left : buttonRect.right - menuWidth
  const left = Math.min(Math.max(padding, unclampedLeft), window.innerWidth - menuWidth - padding)
  const unclampedTop = openBelow ? buttonRect.bottom + gap : buttonRect.top - gap - maxHeight
  const top = Math.min(Math.max(padding, unclampedTop), window.innerHeight - maxHeight - padding)

  return { left, top, maxHeight }
}

export function ActionMenu({
  children,
  label = 'Actions',
  align = 'end',
  buttonClassName = 'rounded p-1 text-text-muted hover:bg-accent/10 hover:text-text',
  iconSize = 15,
  menuClassName = 'w-56',
  onClose,
  onOpen,
}: {
  children: React.ReactNode | ((controls: { close: () => void }) => React.ReactNode)
  label?: string
  align?: 'start' | 'end'
  buttonClassName?: string
  iconSize?: number
  menuClassName?: string
  onClose?: () => void
  onOpen?: () => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = () => {
    setOpen((wasOpen) => {
      if (wasOpen) onClose?.()
      return false
    })
  }

  useEffect(() => {
    const handleOpen = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      if (event.detail !== id) close()
    }

    window.addEventListener(actionMenuOpenEvent, handleOpen)
    return () => window.removeEventListener(actionMenuOpenEvent, handleOpen)
  }, [id])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (menuRef.current?.contains(event.target)) return
      if (buttonRef.current?.contains(event.target)) return
      close()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const handleScroll = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      close()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return
    setPosition(menuPosition(buttonRef.current, menuRef.current, align))
  }, [align, open])

  const openMenu = () => {
    window.dispatchEvent(new CustomEvent(actionMenuOpenEvent, { detail: id }))
    setPosition(null)
    setOpen(true)
    onOpen?.()
  }

  return (
    <>
      <button
        ref={buttonRef}
        aria-label={label}
        aria-expanded={open}
        className={buttonClassName}
        onClick={() => {
          if (open) close()
          else openMenu()
        }}
        title={label}
        type="button"
      >
        <MoreHorizontal size={iconSize} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={`action-menu-scroll fixed z-50 overflow-y-auto rounded-lg border border-border bg-input p-1.5 shadow-2xl shadow-heavy ${menuClassName}`}
            style={position ? position : { left: 0, maxHeight: window.innerHeight - 16, top: 0, visibility: 'hidden' }}
          >
            {typeof children === 'function' ? children({ close }) : children}
          </div>,
          document.body,
        )}
    </>
  )
}

export function ActionMenuItem({
  children,
  danger = false,
  disabled = false,
  onSelect,
}: {
  children: React.ReactNode
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <button
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger ? 'text-danger hover:bg-danger/10' : 'text-text hover:bg-accent/10'
      }`}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      {children}
    </button>
  )
}
