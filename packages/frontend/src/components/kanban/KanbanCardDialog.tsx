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

const reservedLabelNames = new Set(['high', 'medium', 'low'])

function parseLabelInput(value: string) {
  return [...new Set(value
    .split(/[\s,]+/)
    .map((label) => label.trim().replace(/^#/, '').toLowerCase())
    .filter((label) => /^[a-z0-9][a-z0-9_.-]*$/.test(label) && !reservedLabelNames.has(label)))]
}

function reservedLabelInput(value: string) {
  return value
    .split(/[\s,]+/)
    .map((label) => label.trim().replace(/^#/, '').toLowerCase())
    .find((label) => reservedLabelNames.has(label))
}

export function KanbanCardDialog({
  card,
  editable,
  availableLabels,
  onClose,
  onSave,
  open,
  users,
}: {
  card: Card
  editable: boolean
  availableLabels: string[]
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
  const [labels, setLabels] = useState((card.labels ?? []).join(', '))
  const [labelError, setLabelError] = useState('')
  const labelOptions = [...new Set(availableLabels)].filter((label) => !reservedLabelNames.has(label)).sort((a, b) => a.localeCompare(b))

  useEffect(() => {
    if (!open) return
    setTitle(card.title)
    setDescription(card.description ?? '')
    setPriority(card.priority)
    setAssignees(card.assignees ?? [])
    setLabels((card.labels ?? []).join(', '))
    setLabelError('')
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

  const addExistingLabel = (label: string) => {
    if (!label) return
    if (reservedLabelNames.has(label)) {
      setLabelError(`"${label}" is reserved for priority. Use the priority field instead.`)
      return
    }
    const nextLabels = parseLabelInput(labels)
    if (!nextLabels.includes(label)) nextLabels.push(label)
    setLabels(nextLabels.join(', '))
    setLabelError('')
  }

  const save = () => {
    if (!editable) return
    const cleanTitle = title.trim().replace(/\s+/g, ' ')
    if (!cleanTitle) return
    const reservedLabel = reservedLabelInput(labels)
    if (reservedLabel) {
      setLabelError(`"${reservedLabel}" is reserved for priority. Use the priority field instead.`)
      return
    }
    onSave({
      title: cleanTitle,
      description: description.trimEnd() || undefined,
      priority,
      assignees,
      labels: parseLabelInput(labels),
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

          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-text">
              Priority
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`inline-block size-3 shrink-0 rounded-full ${priorityColor(priority)}`}
                />
                <select
                  className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm font-normal text-text outline-none transition focus:border-accent disabled:opacity-70"
                  disabled={!editable}
                  onChange={(event) => setPriority(event.target.value === 'none' ? undefined : event.target.value as CardPriority)}
                  value={priority ?? 'none'}
                >
                  {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </label>

            <div className="grid gap-1.5 text-sm font-medium text-text">
              Assignees
              {users.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {users.map((username) => {
                    const selected = assignees.includes(username)
                    return (
                      <button
                        key={username}
                        className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-normal transition disabled:cursor-default ${selected ? 'border-accent bg-accent/15 text-text' : 'border-border text-text-muted hover:border-accent hover:text-text'}`}
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
                <p className="text-sm font-normal text-text-muted">No users found.</p>
              )}
            </div>
          </div>

          <label className="mb-4 grid gap-1.5 text-sm font-medium text-text">
            Labels / sprint
            {labelOptions.length > 0 && (
              <select
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none transition focus:border-accent disabled:opacity-70"
                disabled={!editable}
                onChange={(event) => {
                  addExistingLabel(event.target.value)
                  event.target.value = ''
                }}
                value=""
              >
                <option value="">Add existing label...</option>
                {labelOptions.map((label) => <option key={label} value={label}>#{label}</option>)}
              </select>
            )}
            <input
              className={`rounded-md border bg-card px-3 py-2 text-sm text-text outline-none transition focus:border-accent disabled:opacity-70 ${labelError ? 'border-danger' : 'border-border'}`}
              disabled={!editable}
              onChange={(event) => {
                setLabels(event.target.value)
                if (labelError) setLabelError('')
              }}
              placeholder="sprint-06, demo-build"
              value={labels}
            />
            <span className="text-xs font-normal text-text-muted">Use comma or space separated labels. Priority labels stay in the priority field.</span>
            {labelError && <span className="text-xs font-normal text-danger">{labelError}</span>}
          </label>

          <div className="mb-2 text-sm font-medium text-text">Description</div>
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
