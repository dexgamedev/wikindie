import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { AppError, notFound } from './errors.js'
import { defaultSpaceFiles } from './defaultSpace.js'
import {
  defaultKanbanBoard,
  defaultKanbanFrontmatter,
  isDoneColumn,
  normalizeKanbanBoard,
  parseKanban,
  parseKanbanColumnMetadata,
  parseTaskIdSettings,
  serializeKanban,
  withKanbanColumnMetadata,
  type CardPriority,
  type KanbanColumnStatus,
} from './kanban.js'

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
  diskSizeBytes: number
  sections: Array<{ title: string; path: string; content: string }>
}

export interface BoardSummaryColumn {
  id: string
  title: string
  status: KanbanColumnStatus
  icon?: string
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

export interface TaskInfo {
  id?: string
  title: string
  description?: string
  priority?: CardPriority
  assignees: string[]
  boardPath: string
  boardTitle: string
  columnId: string
  columnTitle: string
  columnStatus: KanbanColumnStatus
  columnIcon?: string
}

export type TaskOverviewScope = 'board' | 'page'

export interface TaskOverview {
  scope: TaskOverviewScope
  boards: BoardSummary[]
  tasks: TaskInfo[]
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

async function markdownFileSize(relativePath: string) {
  const stat = await fs.stat(safePath(normalizeFilePath(relativePath)))
  return stat.size
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
  const entries = await fs.readdir(SPACE_DIR)
  const meaningfulEntries = entries.filter((entry) => !['.DS_Store', '.gitkeep', 'Thumbs.db'].includes(entry))
  if (meaningfulEntries.length > 0) return

  if (process.env.NODE_ENV === 'production' && process.env.WIKINDIE_INIT_DEFAULT_SPACE !== 'true') {
    console.log(`Starting with an empty workspace at ${SPACE_DIR}. Set WIKINDIE_INIT_DEFAULT_SPACE=true to seed the starter workspace.`)
    return
  }

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
  const pageDiskSizeBytes = await markdownFileSize(resolved.relativePath)

  const loadedSections = await Promise.all(
    sections.map(async (section) => {
      const relativeSectionPath = `${resolved.pagePath}/${section.path}`.replace(/\/+/g, '/')
      try {
        const file = await readMarkdown(relativeSectionPath)
        return { section: { ...section, content: file.content }, diskSizeBytes: await markdownFileSize(relativeSectionPath) }
      } catch {
        await writeMarkdown(relativeSectionPath, `# ${section.title}\n`, {})
        return { section: { ...section, content: `# ${section.title}\n` }, diskSizeBytes: await markdownFileSize(relativeSectionPath) }
      }
    }),
  )
  const sectionDiskSizeBytes = loadedSections.reduce((sum, item) => sum + item.diskSizeBytes, 0)

  return {
    ...page,
    path: resolved.pagePath,
    type: page.frontmatter.kanban === true ? 'board' : 'page',
    diskSizeBytes: pageDiskSizeBytes + sectionDiskSizeBytes,
    sections: loadedSections.map((item) => item.section),
  }
}

function summarizeBoardWithTasks(pagePath: string, file: MarkdownFile): { summary: BoardSummary; tasks: TaskInfo[] } | null {
  if (file.frontmatter.kanban !== true) return null

  const board = parseKanban(file.content)
  const normalizedBoard = normalizeKanbanBoard(board, parseTaskIdSettings(file.frontmatter), parseKanbanColumnMetadata(file.frontmatter))
  const boardPath = normalizePagePath(pagePath)
  const boardTitle = String(file.frontmatter.title ?? pageTitleFromPath(pagePath))
  const columns = normalizedBoard.columns.map((column) => {
    const done = isDoneColumn(column) ? column.cards.length : 0
    return { id: column.id, title: column.title, status: column.status, icon: column.icon, total: column.cards.length, done }
  })
  const totalCards = columns.reduce((sum, column) => sum + column.total, 0)
  const doneCards = columns.reduce((sum, column) => sum + column.done, 0)
  const tasks = normalizedBoard.columns.flatMap((column) =>
    column.cards.map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
      priority: card.priority,
      assignees: [...card.assignees],
      boardPath,
      boardTitle,
      columnId: column.id,
      columnTitle: column.title,
      columnStatus: column.status,
      columnIcon: column.icon,
    })),
  )

  return {
    summary: {
      path: boardPath,
      title: boardTitle,
      icon: typeof file.frontmatter.icon === 'string' ? file.frontmatter.icon : undefined,
      columns,
      totalCards,
      doneCards,
    },
    tasks,
  }
}

function joinStoragePath(base: string, child: string) {
  return [base, child].filter(Boolean).join('/').replace(/\/+/g, '/')
}

async function collectBoardsRecursive(
  dirPath: string,
  boards: BoardSummary[],
  tasks: TaskInfo[] | undefined,
  depth: number,
  maxDepth: number,
) {
  if (depth >= maxDepth) return

  let entries: Dirent[]
  try {
    entries = await fs.readdir(safePath(dirPath), { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === '_sections') continue

    if (entry.isDirectory()) {
      const childPath = joinStoragePath(dirPath, entry.name)
      const indexPath = joinStoragePath(childPath, '_Index.md')
      if (!(await exists(indexPath))) continue
      const details = summarizeBoardWithTasks(childPath, await readMarkdownByPath(indexPath))
      if (details) {
        boards.push(details.summary)
        tasks?.push(...details.tasks)
      }
      await collectBoardsRecursive(childPath, boards, tasks, depth + 1, maxDepth)
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === '_Index.md') continue
    const childPath = joinStoragePath(dirPath, entry.name.replace(/\.md$/, ''))
    const details = summarizeBoardWithTasks(childPath, await readMarkdownByPath(`${childPath}.md`))
    if (details) {
      boards.push(details.summary)
      tasks?.push(...details.tasks)
    }
  }
}

async function readChildBoardsWithTasks(pagePath: string): Promise<{ boards: BoardSummary[]; tasks: TaskInfo[] }> {
  const parent = await resolvePageStoragePath(pagePath)
  if (!parent.index) return { boards: [], tasks: [] }

  const boards: BoardSummary[] = []
  const tasks: TaskInfo[] = []
  await collectBoardsRecursive(parent.pagePath, boards, tasks, 0, 10)

  return { boards: boards.sort((a, b) => a.title.localeCompare(b.title)), tasks }
}

export async function readTaskOverview(pagePath: string): Promise<TaskOverview> {
  const page = await readPage(pagePath)
  if (page.type === 'board') {
    const details = summarizeBoardWithTasks(page.path, page)
    return { scope: 'board', boards: details ? [details.summary] : [], tasks: details?.tasks ?? [] }
  }

  return { scope: 'page', ...(await readChildBoardsWithTasks(page.path)) }
}

export async function writePage(pagePath: string, content: string, frontmatter: Record<string, unknown> = {}) {
  const resolved = await resolvePageStoragePath(pagePath, true)
  await writeMarkdownByPath(resolved.relativePath, content, frontmatter)
  return readPage(pagePath)
}

export async function createPage(pagePath: string, kanban = false) {
  const normalized = normalizePagePath(pagePath)
  const board = defaultKanbanBoard()
  const frontmatter = kanban ? defaultKanbanFrontmatter() : {}
  const content = kanban ? serializeKanban(board) : `# ${pageTitleFromPath(normalized)}\n`
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
  const currentTaskIds = parseTaskIdSettings(page.frontmatter)
  const nextTaskIds = parseTaskIdSettings(nextFrontmatter)
  const taskIdsChanged = Object.hasOwn(patch, 'taskIds') && nextTaskIds.enabled && (currentTaskIds.enabled !== nextTaskIds.enabled || currentTaskIds.prefix !== nextTaskIds.prefix)
  const shouldRewriteBoard =
    nextFrontmatter.kanban === true &&
    (Object.hasOwn(patch, 'kanbanColumns') || taskIdsChanged || page.frontmatter.kanban !== true)

  if (shouldRewriteBoard) {
    const board = normalizeKanbanBoard(parseKanban(page.content), parseTaskIdSettings(nextFrontmatter), parseKanbanColumnMetadata(nextFrontmatter))
    return writePage(page.path, serializeKanban(board), withKanbanColumnMetadata(nextFrontmatter, board))
  }
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
  const board = defaultKanbanBoard()
  const content = kanban ? serializeKanban(board) : '# Untitled\n'
  await writeMarkdown(relativePath, content, kanban ? defaultKanbanFrontmatter() : {})
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
