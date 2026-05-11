import { ArrowLeft, CheckCircle2, Eye, ListChecks, Pencil, Plus, Save, Settings } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type PageBundle, type PageSection } from '../../lib/api'
import { useMobileTaskPanel } from '../layout/AppLayout'
import { wikiIcons } from '../../lib/icons'
import { breadcrumbsFromPath, findTreeNode, goBack, pageNameFromPath, pageUrl } from '../../lib/paths'
import { canDelete, canWrite, useAuthStore, useFilesStore } from '../../lib/store'
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu'
import { Button } from '../ui/Button'
import { PageIcon } from '../ui/PageIcon'
import { MarkdownPreview } from './MarkdownPreview'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function textStats(value: string) {
  const trimmed = value.trim()
  return {
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    characters: value.length,
  }
}

function isCurrentPageEvent(currentPath: string, changedFilePath?: string) {
  if (!changedFilePath) return false
  if (changedFilePath === `${currentPath}.md`) return true
  if (changedFilePath === `${currentPath}/_Index.md`) return true
  if (changedFilePath.startsWith(`${currentPath}/_sections/`)) return true
  return false
}

const iconCategories = Array.from(new Set(wikiIcons.map((icon) => icon.category)))

export function Editor({
  page,
  onEditingChange,
  onPageChange,
}: {
  page: PageBundle
  onEditingChange?: (active: boolean) => void
  onPageChange: (page: PageBundle) => void
}) {
  const navigate = useNavigate()
  const tree = useFilesStore((state) => state.tree)
  const role = useAuthStore((state) => state.role)
  const mayWrite = canWrite(role)
  const mayDelete = canDelete(role)
  const { openTasks } = useMobileTaskPanel()
  const [content, setContent] = useState(page.content)
  const [savedContent, setSavedContent] = useState(page.content)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<'saved' | 'saving' | 'dirty'>('saved')
  const [externalChange, setExternalChange] = useState(false)

  const [title, setTitle] = useState(String(page.frontmatter.title ?? pageNameFromPath(page.path)))
  const [icon, setIcon] = useState(typeof page.frontmatter.icon === 'string' ? page.frontmatter.icon : '')
  const [metaEditing, setMetaEditing] = useState(false)
  const localWriteEventsToIgnore = useRef(0)

  const [sectionDrafts, setSectionDrafts] = useState<Record<string, { title: string; content: string }>>({})
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')

  const frontmatter = useMemo(
    () => ({
      ...page.frontmatter,
      title,
      icon: icon || undefined,
    }),
    [icon, page.frontmatter, title],
  )

  const childPages = useMemo(() => findTreeNode(tree, page.path)?.children ?? [], [page.path, tree])
  const breadcrumbs = useMemo(
    () => breadcrumbsFromPath(page.path).map((c) => ({
      ...c,
      label: findTreeNode(tree, c.path)?.title ?? c.label,
    })),
    [page.path, tree],
  )
  const showBreadcrumbs = breadcrumbs.length > 1
  const stats = useMemo(() => {
    const sectionContent = Object.values(sectionDrafts).map((section) => section.content)
    return textStats([editing ? content : savedContent, ...sectionContent].join('\n\n'))
  }, [content, editing, savedContent, sectionDrafts])
  const statusLabel = mayWrite ? (status === 'dirty' ? 'Unsaved changes' : status === 'saving' ? 'Saving...' : 'Saved') : 'Read only'

  useEffect(() => {
    setContent(page.content)
    setSavedContent(page.content)
    setEditing(false)
    setStatus('saved')
    setExternalChange(false)
    setTitle(String(page.frontmatter.title ?? pageNameFromPath(page.path)))
    setIcon(typeof page.frontmatter.icon === 'string' ? page.frontmatter.icon : '')

    const nextDrafts: Record<string, { title: string; content: string }> = {}
    for (const section of page.sections) nextDrafts[section.path] = { title: section.title, content: section.content }
    setSectionDrafts(nextDrafts)
  }, [page])

  useEffect(() => {
    onEditingChange?.(editing || Boolean(editingSection) || status === 'dirty' || status === 'saving')
    return () => onEditingChange?.(false)
  }, [editing, editingSection, onEditingChange, status])

  useEffect(() => {
    if (status !== 'dirty' || !mayWrite) return
    const timer = window.setTimeout(async () => {
      setStatus('saving')
      localWriteEventsToIgnore.current += 1
      try {
        const updated = await api.writePage(page.path, content, frontmatter)
        setSavedContent(updated.content)
        setStatus('saved')
        setExternalChange(false)
      } catch {
        localWriteEventsToIgnore.current -= 1
        setStatus('dirty')
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [content, frontmatter, mayWrite, page.path, status])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { type: string; path?: string }
      if (detail.type !== 'file:changed' || !isCurrentPageEvent(page.path, detail.path)) return
      if (localWriteEventsToIgnore.current > 0) {
        localWriteEventsToIgnore.current -= 1
        return
      }
      if (editing || editingSection || status === 'dirty' || status === 'saving') setExternalChange(true)
      else void api.page(page.path).then(onPageChange)
    }
    window.addEventListener('wikindie:event', handler)
    return () => window.removeEventListener('wikindie:event', handler)
  }, [editing, editingSection, onPageChange, page.path, status])

  const saveNow = async () => {
    if (!mayWrite) return
    setStatus('saving')
    localWriteEventsToIgnore.current += 1
    try {
      const updated = await api.writePage(page.path, content, frontmatter)
      setSavedContent(updated.content)
      setStatus('saved')
      setExternalChange(false)
    } catch {
      localWriteEventsToIgnore.current -= 1
      setStatus('dirty')
    }
  }

  const showPreview = async () => {
    if (status === 'dirty') await saveNow()
    setEditing(false)
  }

  const saveMeta = async () => {
    if (!mayWrite) return
    if (status === 'dirty') await saveNow()
    localWriteEventsToIgnore.current += 1
    try {
      const updated = await api.patchPageMeta(page.path, { title, icon: icon || undefined })
      onPageChange(updated)
      setMetaEditing(false)
    } catch {
      localWriteEventsToIgnore.current -= 1
    }
  }

  const saveSection = async (section: PageSection) => {
    if (!mayWrite) return
    const draft = sectionDrafts[section.path] ?? { title: section.title, content: section.content }
    localWriteEventsToIgnore.current += 2
    try {
      const updated = await api.upsertSection(page.path, section.path, draft.title.trim() || section.title, draft.content)
      onPageChange(updated)
      setEditingSection(null)
    } catch {
      localWriteEventsToIgnore.current -= 2
    }
  }

  const removeSection = async (sectionPath: string) => {
    if (!mayDelete) return
    localWriteEventsToIgnore.current += 2
    try {
      const updated = await api.deleteSection(page.path, sectionPath)
      onPageChange(updated)
    } catch {
      localWriteEventsToIgnore.current -= 2
    }
  }

  const addSection = async () => {
    if (!mayWrite) return
    const titleValue = newSectionTitle.trim()
    if (!titleValue) return
    const slug = slugify(titleValue) || 'section'
    const sectionPath = `_sections/${slug}.md`
    localWriteEventsToIgnore.current += 2
    try {
      const updated = await api.upsertSection(page.path, sectionPath, titleValue, `# ${titleValue}\n`)
      onPageChange(updated)
      setAddingSection(false)
      setNewSectionTitle('')
    } catch {
      localWriteEventsToIgnore.current -= 2
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-panel px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <button
            className="grid size-8 shrink-0 place-items-center rounded-md text-text-muted transition hover:bg-accent/10 hover:text-text"
            onClick={() => goBack(navigate)}
            title="Go back"
            aria-label="Go back"
          >
            <ArrowLeft size={16} />
          </button>
          <nav className="flex min-w-0 items-center gap-1 overflow-hidden text-sm text-text-muted" aria-label="Page breadcrumbs">
            {(showBreadcrumbs ? breadcrumbs : [{ label: title, path: page.path }]).map((crumb, index) => (
              <Fragment key={crumb.path}>
                {showBreadcrumbs && breadcrumbs.length > 2 && index === breadcrumbs.length - 2 && <span className="shrink-0 rounded px-1 py-1 text-text-muted/70 sm:hidden">...</span>}
                <span className={`flex min-w-0 items-center gap-1 ${showBreadcrumbs && breadcrumbs.length > 2 && index < breadcrumbs.length - 2 ? 'hidden sm:flex' : ''}`}>
                  {index > 0 && <span className="text-text-muted/50">/</span>}
                  <Link className="max-w-[110px] truncate rounded px-1.5 py-1 hover:bg-accent/10 hover:text-text sm:max-w-[130px] md:max-w-[180px]" to={pageUrl(crumb.path)}>
                    {crumb.label}
                  </Link>
                </span>
              </Fragment>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-text-muted sm:flex">
            <span className={`size-1.5 rounded-full ${status === 'saved' ? 'bg-success' : status === 'saving' ? 'bg-warning' : 'bg-info'}`} />
            {statusLabel}
          </span>
          {mayWrite && (
            <div className="hidden rounded-md border border-control-border bg-control p-0.5 text-sm sm:flex">
              <button
                className={`rounded-md px-3 py-1.5 transition ${editing ? 'bg-accent text-white shadow-sm shadow-accent/30' : 'text-text-muted hover:bg-control-hover hover:text-text'}`}
                onClick={() => setEditing(true)}
                type="button"
              >
                Edit
              </button>
              <button
                className={`rounded-md px-3 py-1.5 transition ${!editing ? 'bg-accent text-white shadow-sm shadow-accent/30' : 'text-text-muted hover:bg-control-hover hover:text-text'}`}
                onClick={() => void showPreview()}
                disabled={status === 'saving'}
                type="button"
              >
                Preview
              </button>
            </div>
          )}
          <button
            className="grid size-9 shrink-0 place-items-center rounded-md text-text-muted transition hover:bg-accent/10 hover:text-text xl:hidden"
            onClick={openTasks}
            title="Task overview"
            aria-label="Open task overview"
            type="button"
          >
            <ListChecks size={16} />
          </button>
          <ActionMenu
            buttonClassName="grid size-9 place-items-center rounded-md text-text-muted transition hover:bg-accent/10 hover:text-text"
            iconSize={18}
            label="Page actions"
            menuClassName="w-52"
          >
            {({ close }) => (
              <>
                {mayWrite && (
                  <ActionMenuItem onSelect={() => { setEditing(true); close() }}>
                    <Pencil size={15} /> Edit
                  </ActionMenuItem>
                )}
                {mayWrite && (
                  <ActionMenuItem disabled={status === 'saving'} onSelect={() => { void showPreview(); close() }}>
                    <Eye size={15} /> Preview
                  </ActionMenuItem>
                )}
                {mayWrite && <div className="my-1 border-t border-border" />}
                {mayWrite && (
                  <ActionMenuItem onSelect={() => { setMetaEditing((open) => !open); close() }}>
                    <Settings size={15} /> {metaEditing ? 'Close page meta' : 'Page meta'}
                  </ActionMenuItem>
                )}
                {mayWrite && (
                  <ActionMenuItem onSelect={() => { setAddingSection((open) => !open); close() }}>
                    <Plus size={15} /> {addingSection ? 'Close section form' : 'Add section'}
                  </ActionMenuItem>
                )}
                {mayWrite && (
                  <ActionMenuItem disabled={status === 'saving'} onSelect={() => { void saveNow(); close() }}>
                    <Save size={15} /> Save now
                  </ActionMenuItem>
                )}
                {!mayWrite && <div className="px-3 py-2 text-sm text-text-muted">Read only</div>}
              </>
            )}
          </ActionMenu>
        </div>
      </header>

      <div className="workspace-scroll min-h-0 flex-1 overflow-y-auto bg-content">
        <div className="mx-auto w-full max-w-5xl p-5 md:p-10">
          {externalChange && <div className="mb-6 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">This page changed on disk while you had local edits.</div>}

          {mayWrite && metaEditing && (
            <article className="mb-6 rounded-md border border-border bg-card p-5 shadow-sm shadow-shadow">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-text">Page meta</h3>
                  <p className="text-xs text-text-muted">Update the title and icon shown in navigation.</p>
                </div>
                <Button onClick={() => setMetaEditing(false)}>Close</Button>
              </div>
              <div className="space-y-3">
                {iconCategories.map((category) => (
                  <div key={category}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{category}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {wikiIcons.filter((item) => item.category === category).map((item) => (
                        <button
                          key={item.id}
                          className={`grid size-8 place-items-center rounded-md border text-lg transition hover:border-accent hover:bg-accent/10 ${icon === item.id ? 'border-accent bg-accent/15 shadow-sm shadow-accent/20 ring-1 ring-accent/40' : 'border-transparent'}`}
                          onClick={() => setIcon(item.id)}
                          title={`${item.label} (${item.id})`}
                          type="button"
                        >
                          <PageIcon icon={item.id} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <span>Selected:</span>
                <PageIcon icon={icon} className="text-lg" />
                <span>{icon || 'page'}</span>
              </div>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded border border-accent bg-input px-3 py-2 text-lg font-semibold text-text outline-none" />
              <div className="flex gap-2">
                <Button onClick={saveMeta}>Save title</Button>
                <Button onClick={() => setMetaEditing(false)}>Cancel</Button>
              </div>
            </article>
          )}

          {childPages.length > 0 && (
        <div className="mb-6 rounded-md border border-border bg-card p-5 shadow-sm shadow-shadow">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Pages</h3>
            <span className="text-xs text-text-muted">{childPages.length} linked automatically</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {childPages.map((child) => (
              <Link
                key={child.path}
                to={pageUrl(child.path)}
                className="group rounded-md border border-border bg-card p-4 transition hover:border-accent hover:bg-accent/10"
              >
                <div className="mb-1 flex min-w-0 items-center gap-2">
                  <PageIcon icon={child.icon} fallback={child.type === 'board' ? 'board' : 'page'} />
                  <span className="min-w-0 truncate font-medium text-text group-hover:text-text">{child.title}</span>
                </div>
                <p className="truncate text-xs text-text-muted">{child.path}</p>
              </Link>
            ))}
          </div>
        </div>
          )}

          {mayWrite && editing ? (
            <div className="mb-10 rounded-md border border-border/70 bg-card p-6">
              <textarea
                className="min-h-[52vh] w-full resize-y bg-transparent font-mono text-[15px] leading-7 text-text outline-none"
                value={content}
                onChange={(event) => {
                  setContent(event.target.value)
                  setStatus('dirty')
                }}
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="mb-10">
              <MarkdownPreview content={savedContent} frameless />
            </div>
          )}

          <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Sections</h3>
        </div>

        {mayWrite && addingSection && (
          <form
            className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void addSection()
            }}
          >
            <input
              autoFocus
              value={newSectionTitle}
              onChange={(event) => setNewSectionTitle(event.target.value)}
              className="min-w-0 flex-1 rounded border border-accent bg-input px-3 py-2 text-sm text-text outline-none"
              placeholder="Section title"
            />
            <Button type="submit">Create</Button>
          </form>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {page.sections.map((section) => {
            const draft = sectionDrafts[section.path] ?? { title: section.title, content: section.content }
            const sectionEditing = editingSection === section.path

            return (
              <article key={section.path} className="rounded-md border border-border bg-card p-5 shadow-sm shadow-shadow">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  {mayWrite && sectionEditing ? (
                    <input
                      value={draft.title}
                      onChange={(event) => setSectionDrafts((prev) => ({ ...prev, [section.path]: { ...draft, title: event.target.value } }))}
                      className="min-w-0 flex-1 rounded border border-accent bg-input px-2 py-1.5 text-sm text-text outline-none"
                    />
                  ) : (
                    <h4 className="font-semibold">{draft.title}</h4>
                  )}
                  <div className="flex gap-2">
                    {mayWrite && sectionEditing ? (
                      <>
                        <Button onClick={() => void saveSection(section)}>Save</Button>
                        <Button onClick={() => setEditingSection(null)}>Preview</Button>
                      </>
                    ) : (
                      mayWrite && <Button onClick={() => setEditingSection(section.path)}>Edit</Button>
                    )}
                    {mayDelete && <Button onClick={() => void removeSection(section.path)}>Remove</Button>}
                  </div>
                </div>
                {mayWrite && sectionEditing ? (
                  <textarea
                    className="min-h-[180px] w-full resize-y rounded-md border border-border bg-input p-3 font-mono text-sm text-text outline-none focus:border-accent"
                    value={draft.content}
                    onChange={(event) => setSectionDrafts((prev) => ({ ...prev, [section.path]: { ...draft, content: event.target.value } }))}
                    spellCheck={false}
                  />
                ) : (
                  <MarkdownPreview content={draft.content} frameless />
                )}
              </article>
            )
          })}
          {!page.sections.length && (
            <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-text-muted xl:col-span-2">
              No sections yet. Add one to split this page into modular sub-files.
            </div>
          )}
        </div>
          </div>
      </div>
      </div>

      <footer className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-t border-border bg-panel px-3 text-xs text-text-muted md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span>{stats.words.toLocaleString()} words</span>
          <span>{stats.characters.toLocaleString()} characters</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-1.5 sm:flex">
            <CheckCircle2 size={13} className={status === 'saved' ? 'text-success' : 'text-text-muted'} /> Markdown
          </span>
          <span>{editing ? 'Editing' : 'Live Preview'}</span>
        </div>
      </footer>
    </section>
  )
}
