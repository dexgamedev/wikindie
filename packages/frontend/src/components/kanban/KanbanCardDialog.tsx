import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import type { CardPriority, KanbanCard as Card } from '../../lib/api'
import { priorityColor } from '../../lib/priority'
import { Button } from '../ui/Button'
import { UserIconBadge } from '../ui/AssigneeBadges'

const BlockEditor = lazy(() => import('../editor/BlockEditor').then((module) => ({ default: module.BlockEditor })))

const priorityOptions: Array<{ value: CardPriority | 'none'; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'None' },
]

export function KanbanCardDialog({
  card,
  editable,
  onClose,
  onSave,
  open,
  users,
}: {
  card: Card
  editable: boolean
  onClose: () => void
  onSave: (patch: Partial<Card>) => void
  open: boolean
  users: string[]
}) {
  const backdropPointerDown = useRef(false)
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description ?? '')
  const [priority, setPriority] = useState<CardPriority | undefined>(card.priority)
  const [assignees, setAssignees] = useState<string[]>(card.assignees ?? [])

  useEffect(() => {
    if (!open) return
    setTitle(card.title)
    setDescription(card.description ?? '')
    setPriority(card.priority)
    setAssignees(card.assignees ?? [])
  }, [card, open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  const toggleAssignee = (username: string) => {
    setAssignees((current) => (current.includes(username) ? current.filter((assignee) => assignee !== username) : [...current, username]))
  }

  const save = () => {
    if (!editable) return
    const cleanTitle = title.trim().replace(/\s+/g, ' ')
    if (!cleanTitle) return
    onSave({
      title: cleanTitle,
      description: description.trimEnd() || undefined,
      priority,
      assignees,
    })
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-overlay p-3 sm:p-6"
      onPointerDown={(event) => {
        backdropPointerDown.current = event.target === event.currentTarget
      }}
      onPointerUp={(event) => {
        if (backdropPointerDown.current && event.target === event.currentTarget) onClose()
        backdropPointerDown.current = false
      }}
    >
      <section
        aria-modal="true"
        className="mx-auto mt-8 flex max-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-border bg-input shadow-lg shadow-heavy"
        role="dialog"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-panel px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Task editor</p>
            <h2 className="truncate text-lg font-semibold text-text">{card.id ? `[${card.id}] ` : ''}{card.title}</h2>
          </div>
          <button
            aria-label="Close task editor"
            className="grid size-9 shrink-0 place-items-center rounded-md text-text-muted transition hover:bg-accent/10 hover:text-text"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="workspace-scroll min-h-0 flex-1 overflow-y-auto p-4">
          {card.id && <div className="mb-3 inline-flex rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">{card.id}</div>}

          <label className="mb-4 grid gap-1.5 text-sm font-medium text-text">
            Name
            <input
              autoFocus
              className="rounded-md border border-border bg-card px-3 py-2 text-base text-text outline-none transition focus:border-accent disabled:opacity-70"
              disabled={!editable}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-text">
              Priority
              <select
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none transition focus:border-accent disabled:opacity-70"
                disabled={!editable}
                onChange={(event) => setPriority(event.target.value === 'none' ? undefined : event.target.value as CardPriority)}
                value={priority ?? 'none'}
              >
                {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <div className="grid gap-1.5 text-sm font-medium text-text">
              Assignees
              <div className="rounded-md border border-border bg-card p-2">
                {users.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {users.map((username) => {
                      const selected = assignees.includes(username)
                      return (
                        <button
                          key={username}
                          className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition disabled:cursor-default ${selected ? 'border-accent bg-accent/15 text-text' : 'border-border text-text-muted hover:border-accent hover:text-text'}`}
                          disabled={!editable}
                          onClick={() => toggleAssignee(username)}
                          type="button"
                        >
                          <UserIconBadge username={username} className="size-5" />
                          <span>{username}</span>
                          {selected && <Check size={12} className="text-accent" />}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">No users found.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
            <span className={`size-2 rounded-full ${priorityColor(priority)}`} /> Description
          </div>
          <div className="overflow-hidden rounded-md border border-border bg-card p-2">
            <Suspense fallback={<div className="grid min-h-[260px] place-items-center text-sm text-text-muted">Loading editor...</div>}>
              <BlockEditor
                className="min-h-[260px] w-full"
                editable={editable}
                onChange={setDescription}
                value={description}
              />
            </Suspense>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-panel px-4 py-3">
          <Button onClick={onClose}>{editable ? 'Cancel' : 'Close'}</Button>
          {editable && <Button onClick={save} variant="primary">Save task</Button>}
        </footer>
      </section>
    </div>,
    document.body,
  )
}
