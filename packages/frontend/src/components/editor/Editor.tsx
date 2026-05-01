import { useEffect, useMemo, useState } from 'react'
import { api, type PageBundle, type PageSection } from '../../lib/api'
import { Button } from '../ui/Button'
import { MarkdownPreview } from './MarkdownPreview'

function pageNameFromPath(pagePath: string) {
  const parts = pagePath.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : 'Home'
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function isCurrentPageEvent(currentPath: string, changedFilePath?: string) {
  if (!changedFilePath) return false
  if (changedFilePath === `${currentPath}.md`) return true
  if (changedFilePath === `${currentPath}/_Index.md`) return true
  if (changedFilePath.startsWith(`${currentPath}/_sections/`)) return true
  return false
}

const quickEmoji = ['📄', '🧠', '🚀', '🛠️', '📌', '✅', '🗂️', '🎯']

export function Editor({ page, onPageChange }: { page: PageBundle; onPageChange: (page: PageBundle) => void }) {
  const [content, setContent] = useState(page.content)
  const [savedContent, setSavedContent] = useState(page.content)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<'saved' | 'saving' | 'dirty'>('saved')
  const [externalChange, setExternalChange] = useState(false)

  const [title, setTitle] = useState(String(page.frontmatter.title ?? pageNameFromPath(page.path)))
  const [icon, setIcon] = useState(typeof page.frontmatter.icon === 'string' ? page.frontmatter.icon : '')
  const [metaEditing, setMetaEditing] = useState(false)

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
    if (status !== 'dirty') return
    const timer = window.setTimeout(async () => {
      setStatus('saving')
      const updated = await api.writePage(page.path, content, frontmatter)
      setSavedContent(updated.content)
      onPageChange(updated)
      setStatus('saved')
      setEditing(false)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [content, frontmatter, onPageChange, page.path, status])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { type: string; path?: string }
      if (detail.type !== 'file:changed' || !isCurrentPageEvent(page.path, detail.path)) return
      if (status === 'dirty' || status === 'saving') setExternalChange(true)
      else void api.page(page.path).then(onPageChange)
    }
    window.addEventListener('wikindie:event', handler)
    return () => window.removeEventListener('wikindie:event', handler)
  }, [onPageChange, page.path, status])

  const saveNow = async () => {
    setStatus('saving')
    const updated = await api.writePage(page.path, content, frontmatter)
    setSavedContent(updated.content)
    onPageChange(updated)
    setStatus('saved')
    setEditing(false)
  }

  const saveMeta = async () => {
    const updated = await api.patchPageMeta(page.path, { title, icon: icon || undefined })
    onPageChange(updated)
    setMetaEditing(false)
  }

  const saveSection = async (section: PageSection) => {
    const draft = sectionDrafts[section.path] ?? { title: section.title, content: section.content }
    const updated = await api.upsertSection(page.path, section.path, draft.title.trim() || section.title, draft.content)
    onPageChange(updated)
    setEditingSection(null)
  }

  const removeSection = async (sectionPath: string) => {
    const updated = await api.deleteSection(page.path, sectionPath)
    onPageChange(updated)
  }

  const addSection = async () => {
    const titleValue = newSectionTitle.trim()
    if (!titleValue) return
    const slug = slugify(titleValue) || 'section'
    const sectionPath = `_sections/${slug}.md`
    const updated = await api.upsertSection(page.path, sectionPath, titleValue, `# ${titleValue}\n`)
    onPageChange(updated)
    setAddingSection(false)
    setNewSectionTitle('')
  }

  return (
    <section className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm text-text-muted">{page.path}</p>
          {metaEditing ? (
            <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                {quickEmoji.map((item) => (
                  <button key={item} className="rounded-md border border-border px-2 py-1 text-base hover:border-accent" onClick={() => setIcon(item)}>
                    {item}
                  </button>
                ))}
                <input value={icon} onChange={(event) => setIcon(event.target.value)} className="w-16 rounded border border-border bg-slate-950 px-2 py-1 text-sm" placeholder="🙂" />
              </div>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded border border-accent bg-slate-950 px-3 py-2 text-lg font-semibold text-text outline-none" />
              <div className="flex gap-2">
                <Button onClick={saveMeta}>Save title</Button>
                <Button onClick={() => setMetaEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <h2 className="truncate text-2xl font-semibold">{icon ? `${icon} ` : ''}{title}</h2>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <span>{status === 'dirty' ? 'Unsaved changes' : status === 'saving' ? 'Saving...' : 'Saved'}</span>
          <Button onClick={() => setMetaEditing((v) => !v)}>{metaEditing ? 'Close meta' : 'Page meta'}</Button>
          {editing ? (
            <>
              <Button onClick={() => setEditing(false)} disabled={status === 'saving'}>Preview</Button>
              <Button onClick={saveNow} disabled={status === 'saving'}>Save</Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>
      </div>

      {externalChange && <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">This page changed on disk while you had local edits.</div>}

      {editing ? (
        <textarea
          className="min-h-[50vh] w-full resize-y rounded-2xl border border-border bg-surface p-5 font-mono text-[15px] leading-7 text-text outline-none focus:border-accent"
          value={content}
          onChange={(event) => {
            setContent(event.target.value)
            setStatus('dirty')
          }}
          spellCheck={false}
        />
      ) : (
        <MarkdownPreview content={savedContent} />
      )}

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Sections</h3>
          <Button onClick={() => setAddingSection((v) => !v)}>{addingSection ? 'Close' : 'Add section'}</Button>
        </div>

        {addingSection && (
          <form
            className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3"
            onSubmit={(event) => {
              event.preventDefault()
              void addSection()
            }}
          >
            <input
              autoFocus
              value={newSectionTitle}
              onChange={(event) => setNewSectionTitle(event.target.value)}
              className="min-w-0 flex-1 rounded border border-accent bg-slate-950 px-3 py-2 text-sm text-text outline-none"
              placeholder="Section title"
            />
            <Button type="submit">Create</Button>
          </form>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {page.sections.map((section) => {
            const draft = sectionDrafts[section.path] ?? { title: section.title, content: section.content }
            const sectionEditing = editingSection === section.path

            return (
              <article key={section.path} className="rounded-2xl border border-border bg-surface p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  {sectionEditing ? (
                    <input
                      value={draft.title}
                      onChange={(event) => setSectionDrafts((prev) => ({ ...prev, [section.path]: { ...draft, title: event.target.value } }))}
                      className="min-w-0 flex-1 rounded border border-accent bg-slate-950 px-2 py-1.5 text-sm text-text outline-none"
                    />
                  ) : (
                    <h4 className="font-semibold">{draft.title}</h4>
                  )}
                  <div className="flex gap-2">
                    {sectionEditing ? (
                      <>
                        <Button onClick={() => void saveSection(section)}>Save</Button>
                        <Button onClick={() => setEditingSection(null)}>Preview</Button>
                      </>
                    ) : (
                      <Button onClick={() => setEditingSection(section.path)}>Edit</Button>
                    )}
                    <Button onClick={() => void removeSection(section.path)}>Remove</Button>
                  </div>
                </div>
                {sectionEditing ? (
                  <textarea
                    className="min-h-[180px] w-full resize-y rounded-xl border border-border bg-slate-950 p-3 font-mono text-sm text-text outline-none focus:border-accent"
                    value={draft.content}
                    onChange={(event) => setSectionDrafts((prev) => ({ ...prev, [section.path]: { ...draft, content: event.target.value } }))}
                    spellCheck={false}
                  />
                ) : (
                  <MarkdownPreview content={draft.content} />
                )}
              </article>
            )
          })}
          {!page.sections.length && (
            <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-text-muted xl:col-span-2">
              No sections yet. Add one to split this page into modular sub-files.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
