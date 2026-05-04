import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { AppError, notFound } from './errors.js'
import { defaultSpaceFiles } from './defaultSpace.js'
import { parseKanban } from './kanban.js'

export const SPACE_DIR = path.resolve(process.env.SPACE_DIR ?? './space')

export interface MarkdownFile {
  content: string
  frontmatter: Record<string, unknown>
}

export interface PageSection {
  title: string
  path: string
}

export interface PageBundle extends MarkdownFile {
  path: string
  type: 'page' | 'board'
  sections: Array<{ title: string; path: string; content: string }>
}

export interface BoardSummaryColumn {
  title: string
  total: number
  done: number
}

export interface BoardSummary {
  path: string
  title: string
  icon?: string
  columns: BoardSummaryColumn[]
  totalCards: number
  doneCards: number
}

export function safePath(relativePath = '') {
  const resolved = path.resolve(SPACE_DIR, relativePath)
  if (resolved !== SPACE_DIR && !resolved.startsWith(SPACE_DIR + path.sep)) {
    throw new AppError(403, 'Path traversal detected')
  }
  return resolved
}

export function normalizeFilePath(input: string) {
  const clean = input.replaceAll('\\', '/').replace(/^\/+/, '')
  return clean.endsWith('.md') ? clean : `${clean}.md`
}

export function normalizePagePath(input: string) {
  const clean = input.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\.md$/, '').replace(/\/_Index$/, '')
  return clean.replace(/\/+$/, '')
}

export function pageToLeafPath(pagePath: string) {
  return `${normalizePagePath(pagePath)}.md`
}

export function pageToIndexPath(pagePath: string) {
  return `${normalizePagePath(pagePath)}/_Index.md`
}

export function pageTitleFromPath(pagePath: string) {
  const parts = normalizePagePath(pagePath).split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : 'Home'
}

async function exists(relativePath: string) {
  try {
    await fs.stat(safePath(relativePath))
    return true
  } catch {
    return false
  }
}

async function readMarkdownByPath(relativePath: string): Promise<MarkdownFile> {
  const raw = await fs.readFile(safePath(relativePath), 'utf8')
  const parsed = matter(raw)
  return { content: parsed.content, frontmatter: parsed.data }
}

async function writeMarkdownByPath(relativePath: string, content: string, frontmatter: Record<string, unknown> = {}) {
  const fullPath = safePath(relativePath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  const body = Object.keys(frontmatter).length ? matter.stringify(content, frontmatter) : content
  await fs.writeFile(fullPath, body.trimEnd() + '\n', 'utf8')
}

export async function resolvePageStoragePath(pagePath: string, forWrite = false) {
  const normalized = normalizePagePath(pagePath)
  const indexPath = pageToIndexPath(normalized)
  const leafPath = pageToLeafPath(normalized)
  if (await exists(indexPath)) return { pagePath: normalized, relativePath: indexPath, index: true }
  if (await exists(leafPath)) return { pagePath: normalized, relativePath: leafPath, index: false }
  if (forWrite) return { pagePath: normalized, relativePath: leafPath, index: false }
  throw notFound('Page not found')
}

async function ensurePageContainer(pagePath: string) {
  const normalized = normalizePagePath(pagePath)
  if (!normalized) return

  const indexPath = pageToIndexPath(normalized)
  if (await exists(indexPath)) return

  const leafPath = pageToLeafPath(normalized)
  if (await exists(leafPath)) {
    await fs.mkdir(safePath(normalized), { recursive: true })
    await fs.rename(safePath(leafPath), safePath(indexPath))
    return
  }

  await fs.mkdir(safePath(normalized), { recursive: true })
  await writeMarkdownByPath(indexPath, `# ${pageTitleFromPath(normalized)}\n`)
}

function pageParent(pagePath: string) {
  const parts = normalizePagePath(pagePath).split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
}

async function ensureMoveTargetParent(parentPath: string) {
  const normalized = normalizePagePath(parentPath)
  if (!normalized) return
  const indexPath = pageToIndexPath(normalized)
  if (await exists(indexPath)) return
  const leafPath = pageToLeafPath(normalized)
  if (await exists(leafPath)) {
    await ensurePageContainer(normalized)
    return
  }
  throw notFound('Target parent page not found')
}

function parseSections(frontmatter: Record<string, unknown>): PageSection[] {
  const raw = frontmatter.sections
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const title = String((item as Record<string, unknown>).title ?? '').trim()
      const sectionPath = String((item as Record<string, unknown>).path ?? '').trim()
      if (!title || !sectionPath) return null
      return { title, path: sectionPath.replaceAll('\\', '/').replace(/^\/+/, '') }
    })
    .filter((section): section is PageSection => Boolean(section))
}

export async function ensureSpace() {
  await fs.mkdir(SPACE_DIR, { recursive: true })
  const hasWorkspacePage = (await exists('Workspace/_Index.md')) || (await exists('Workspace.md'))
  if (hasWorkspacePage) return

  await Promise.allSettled(
    defaultSpaceFiles.map(async (file) => {
      if (await exists(file.relativePath)) return
      await writeMarkdownByPath(file.relativePath, file.content, file.frontmatter ?? {})
    }),
  )
}

export async function readMarkdown(relativePath: string): Promise<MarkdownFile> {
  const fullPath = safePath(normalizeFilePath(relativePath))
  try {
    const raw = await fs.readFile(fullPath, 'utf8')
    const parsed = matter(raw)
    return { content: parsed.content, frontmatter: parsed.data }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw notFound('Page not found')
    throw error
  }
}

export async function writeMarkdown(
  relativePath: string,
  content: string,
  frontmatter: Record<string, unknown> = {},
) {
  const relPath = normalizeFilePath(relativePath)
  await writeMarkdownByPath(relPath, content, frontmatter)
  return readMarkdown(relPath)
}

export async function readPage(pagePath: string): Promise<PageBundle> {
  const resolved = await resolvePageStoragePath(pagePath)
  const page = await readMarkdownByPath(resolved.relativePath)
  const sections = parseSections(page.frontmatter)

  const loadedSections = await Promise.all(
    sections.map(async (section) => {
      const relativeSectionPath = `${resolved.pagePath}/${section.path}`.replace(/\/+/g, '/')
      try {
        const file = await readMarkdown(relativeSectionPath)
        return { ...section, content: file.content }
      } catch {
        await writeMarkdown(relativeSectionPath, `# ${section.title}\n`, {})
        return { ...section, content: `# ${section.title}\n` }
      }
    }),
  )

  return {
    ...page,
    path: resolved.pagePath,
    type: page.frontmatter.kanban === true ? 'board' : 'page',
    sections: loadedSections,
  }
}

function summarizeBoard(pagePath: string, file: MarkdownFile): BoardSummary | null {
  if (file.frontmatter.kanban !== true) return null

  const columns = parseKanban(file.content).columns.map((column) => {
    const done = column.cards.filter((card) => card.done).length
    return { title: column.title, total: column.cards.length, done }
  })
  const totalCards = columns.reduce((sum, column) => sum + column.total, 0)
  const doneCards = columns.reduce((sum, column) => sum + column.done, 0)

  return {
    path: normalizePagePath(pagePath),
    title: String(file.frontmatter.title ?? pageTitleFromPath(pagePath)),
    icon: typeof file.frontmatter.icon === 'string' ? file.frontmatter.icon : undefined,
    columns,
    totalCards,
    doneCards,
  }
}

export async function readChildBoards(pagePath: string): Promise<BoardSummary[]> {
  const parent = await resolvePageStoragePath(pagePath)
  if (!parent.index) return []

  const parentDir = safePath(parent.pagePath)
  const entries = await fs.readdir(parentDir, { withFileTypes: true })
  const boards: BoardSummary[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === '_sections') continue

    if (entry.isDirectory()) {
      const childPath = `${parent.pagePath}/${entry.name}`.replace(/\/+/g, '/')
      const indexPath = `${childPath}/_Index.md`
      if (!(await exists(indexPath))) continue
      const summary = summarizeBoard(childPath, await readMarkdownByPath(indexPath))
      if (summary) boards.push(summary)
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === '_Index.md') continue
    const childPath = `${parent.pagePath}/${entry.name.replace(/\.md$/, '')}`.replace(/\/+/g, '/')
    const summary = summarizeBoard(childPath, await readMarkdownByPath(`${childPath}.md`))
    if (summary) boards.push(summary)
  }

  return boards.sort((a, b) => a.title.localeCompare(b.title))
}

export async function writePage(pagePath: string, content: string, frontmatter: Record<string, unknown> = {}) {
  const resolved = await resolvePageStoragePath(pagePath, true)
  await writeMarkdownByPath(resolved.relativePath, content, frontmatter)
  return readPage(pagePath)
}

export async function createPage(pagePath: string, kanban = false) {
  const normalized = normalizePagePath(pagePath)
  const frontmatter = kanban ? { kanban: true } : {}
  const content = kanban ? '## To Do\n- [ ] New card\n## In Progress\n## Done\n' : `# ${pageTitleFromPath(normalized)}\n`
  await writeMarkdownByPath(pageToLeafPath(normalized), content, frontmatter)
  return normalized
}

export async function createChildPage(parentPath: string, pageName: string, kanban = false) {
  const parent = normalizePagePath(parentPath)
  const childName = normalizePagePath(pageName).split('/').filter(Boolean).pop()
  if (!childName) throw new AppError(400, 'Invalid child name')
  await ensurePageContainer(parent)
  const childPath = `${parent}/${childName}`
  await createPage(childPath, kanban)
  return childPath
}

export async function updatePageMeta(pagePath: string, patch: Record<string, unknown>) {
  const page = await readPage(pagePath)
  const nextFrontmatter = { ...page.frontmatter, ...patch }
  return writePage(page.path, page.content, nextFrontmatter)
}

export async function upsertSection(pagePath: string, sectionPath: string, sectionTitle: string, content: string) {
  const page = await readPage(pagePath)
  const normalizedSectionPath = sectionPath.replaceAll('\\', '/').replace(/^\/+/, '')
  const sections = parseSections(page.frontmatter)
  const existingIndex = sections.findIndex((section) => section.path === normalizedSectionPath)
  if (existingIndex >= 0) sections[existingIndex].title = sectionTitle
  else sections.push({ title: sectionTitle, path: normalizedSectionPath })

  await writeMarkdown(`${page.path}/${normalizedSectionPath}`, content, {})
  return writePage(page.path, page.content, { ...page.frontmatter, sections })
}

export async function deleteSection(pagePath: string, sectionPath: string) {
  const page = await readPage(pagePath)
  const normalizedSectionPath = sectionPath.replaceAll('\\', '/').replace(/^\/+/, '')
  const sections = parseSections(page.frontmatter).filter((section) => section.path !== normalizedSectionPath)
  await deleteItem(`${page.path}/${normalizedSectionPath}`)
  return writePage(page.path, page.content, { ...page.frontmatter, sections })
}

export async function createFolder(relativePath: string) {
  await fs.mkdir(safePath(relativePath), { recursive: true })
}

export async function createFile(relativePath: string, kanban = false) {
  const content = kanban ? '## To Do\n- [ ] New card\n## In Progress\n## Done\n' : '# Untitled\n'
  await writeMarkdown(relativePath, content, kanban ? { kanban: true } : {})
}

export async function deleteItem(relativePath: string) {
  await fs.rm(safePath(relativePath), { recursive: true, force: true })
}

export async function moveItem(from: string, to: string) {
  const fromPath = safePath(from)
  const toPath = safePath(to)
  await fs.mkdir(path.dirname(toPath), { recursive: true })
  await fs.rename(fromPath, toPath)
}

export async function movePage(fromPagePath: string, toPagePath: string) {
  const from = normalizePagePath(fromPagePath)
  const to = normalizePagePath(toPagePath)
  if (to.startsWith(`${from}/`)) throw new AppError(400, 'Cannot move page into its own child')

  await ensureMoveTargetParent(pageParent(to))

  const fromIndex = pageToIndexPath(from)
  const fromLeaf = pageToLeafPath(from)
  if (await exists(fromIndex)) {
    await moveItem(from, to)
    return
  }
  if (await exists(fromLeaf)) {
    await moveItem(fromLeaf, pageToLeafPath(to))
    return
  }
  throw notFound('Page not found')
}

export async function deletePage(pagePath: string) {
  const normalized = normalizePagePath(pagePath)
  const indexPath = pageToIndexPath(normalized)
  const leafPath = pageToLeafPath(normalized)
  if (await exists(indexPath)) {
    await deleteItem(normalized)
    return
  }
  if (await exists(leafPath)) {
    await deleteItem(leafPath)
    return
  }
  throw notFound('Page not found')
}
