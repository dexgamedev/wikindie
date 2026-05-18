import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult, GetPromptResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { AppError, notFound } from '../lib/errors.js'
import {
  createChildPage,
  createPage,
  deletePage,
  deleteSection,
  movePage,
  normalizePagePath,
  pageIdFromFrontmatter,
  pageTitleFromPath,
  readPage,
  readPageById,
  readPageMarkdownByPath,
  readTaskOverview,
  resolvePageId,
  safePath,
  updatePageMeta,
  upsertSection,
  writePage,
  joinStoragePath,
  type PageBundle,
  type TaskInfo,
} from '../lib/files.js'
import {
  createTaskComment,
  findKanbanCard,
  findKanbanComment,
  generateCardUid,
  isReservedLabelName,
  normalizeKanbanBoard,
  parseKanban,
  parseKanbanColumnMetadata,
  parseTaskComments,
  parseTaskIdSettings,
  serializeKanban,
  withKanbanColumnMetadata,
  type CardPriority,
  type KanbanBoard,
  type KanbanCard,
} from '../lib/kanban.js'
import type { SessionUser } from '../lib/jwt.js'
import { assertPermission } from '../middleware/permissions.js'
import { buildTree, type TreeNode } from '../lib/tree.js'
import { readRecentPages } from '../routes/recents.js'
import { readWorkspaceStats } from '../routes/stats.js'

type PageIdentifier = { path?: string; id?: string }
type BoardLocation = { boardPath?: string; boardId?: string }

const prioritySchema = z.enum(['high', 'medium', 'low'])
const pageIdentifierSchema = {
  path: z.string().optional().describe('Human page path, such as Projects/Wikindie/Roadmap'),
  id: z.string().optional().describe('Stable page id from frontmatter, such as pg_...'),
}
const boardLocationSchema = {
  boardPath: z.string().optional().describe('Human board path'),
  boardId: z.string().optional().describe('Stable board page id'),
}

function toolResult(data: unknown): CallToolResult {
  const structuredContent = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : { result: data }
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent,
  }
}

function textToolResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

async function pagePathFromIdentifier(input: PageIdentifier) {
  if (input.id) return (await resolvePageId(input.id)).path
  const cleanPath = normalizePagePath(input.path ?? '')
  if (!cleanPath) throw new AppError(400, 'Missing page path or id')
  return cleanPath
}

async function readPageFromIdentifier(input: PageIdentifier) {
  if (input.id) return readPageById(input.id)
  return readPage(await pagePathFromIdentifier(input))
}

async function boardPathFromLocation(input: BoardLocation) {
  if (input.boardId) return (await resolvePageId(input.boardId)).path
  const cleanPath = normalizePagePath(input.boardPath ?? '')
  if (!cleanPath) throw new AppError(400, 'Missing boardPath or boardId')
  return cleanPath
}

function boardForPage(page: PageBundle) {
  if (page.type !== 'board') throw new AppError(400, 'Page is not a kanban board')
  return normalizeKanbanBoard(parseKanban(page.content), parseTaskIdSettings(page.frontmatter), parseKanbanColumnMetadata(page.frontmatter), true, parseTaskComments(page.frontmatter))
}

function assertNoReservedLabels(labels: string[]) {
  const reserved = labels.find((label) => isReservedLabelName(label))
  if (reserved) throw new AppError(400, `Label "${reserved}" is reserved for priority. Use the priority field instead.`)
}

async function writeBoard(page: PageBundle, board: KanbanBoard) {
  for (const column of board.columns) {
    for (const card of column.cards) assertNoReservedLabels(card.labels ?? [])
  }

  const frontmatter = { ...page.frontmatter, kanban: true }
  const normalized = normalizeKanbanBoard(board, parseTaskIdSettings(frontmatter), parseKanbanColumnMetadata(frontmatter), false, parseTaskComments(frontmatter))
  const updated = await writePage(page.path, serializeKanban(normalized), withKanbanColumnMetadata(frontmatter, normalized))
  return { ...updated, board: normalized }
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...(node.children ? flattenTree(node.children) : [])])
}

async function readAllBoardPages() {
  const nodes = flattenTree(await buildTree()).filter((node) => node.type === 'board')
  const pages = await Promise.all(nodes.map((node) => readPage(node.path).catch(() => null)))
  return pages.filter((page): page is PageBundle => Boolean(page && page.type === 'board'))
}

function taskMatchesFilters(task: TaskInfo, filters: { status?: string; priority?: CardPriority; assignee?: string; label?: string; includeArchived?: boolean }) {
  if (!filters.includeArchived && task.archived) return false
  if (filters.status && task.columnStatus !== filters.status && task.columnId !== filters.status) return false
  if (filters.priority && task.priority !== filters.priority) return false
  if (filters.assignee && !task.assignees.some((assignee) => assignee.toLowerCase() === filters.assignee?.toLowerCase())) return false
  if (filters.label && !task.labels.some((label) => label.toLowerCase() === filters.label?.toLowerCase())) return false
  return true
}

async function listTasks(input: PageIdentifier & { status?: string; priority?: CardPriority; assignee?: string; label?: string; includeArchived?: boolean }) {
  if (input.id || input.path) {
    const pagePath = await pagePathFromIdentifier(input)
    const overview = await readTaskOverview(pagePath)
    return { ...overview, tasks: overview.tasks.filter((task) => taskMatchesFilters(task, input)) }
  }

  const boards = await readAllBoardPages()
  const summaries = []
  const tasks: TaskInfo[] = []
  for (const board of boards) {
    const overview = await readTaskOverview(board.path)
    summaries.push(...overview.boards)
    tasks.push(...overview.tasks)
  }
  return { scope: 'page' as const, boards: summaries, tasks: tasks.filter((task) => taskMatchesFilters(task, input)) }
}

function findCard(board: KanbanBoard, taskId: string) {
  for (const column of board.columns) {
    const cardIndex = column.cards.findIndex((card) => card.id === taskId)
    if (cardIndex >= 0) return { column, card: column.cards[cardIndex], cardIndex }
  }
  return null
}

function requireCommentBody(body: string) {
  const cleanBody = body.trim()
  if (!cleanBody) throw new AppError(400, 'Missing comment body')
  return cleanBody
}

async function resolveTaskBoard(taskId: string, location: BoardLocation = {}) {
  const pages = location.boardId || location.boardPath ? [await readPage(await boardPathFromLocation(location))] : await readAllBoardPages()
  const matches = []
  for (const page of pages) {
    if (page.type !== 'board') continue
    const board = boardForPage(page)
    const match = findCard(board, taskId)
    if (match) matches.push({ page, board, ...match })
  }
  if (matches.length === 0) throw notFound('Task not found')
  if (matches.length > 1) throw new AppError(409, `Duplicate task id: ${taskId}`)
  return matches[0]
}

function makeCard(input: { title: string; description?: string; priority?: CardPriority; assignees?: string[]; labels?: string[] }): KanbanCard {
  const labels = input.labels ?? []
  assertNoReservedLabels(labels)
  return {
    title: input.title,
    description: input.description,
    priority: input.priority,
    assignees: input.assignees ?? [],
    labels,
  }
}

interface SearchHit {
  id?: string
  path: string
  title: string
  type: 'page' | 'board'
  matches: Array<{ line: number; snippet: string }>
}

async function collectSearchResults(dirPath: string, query: string, results: SearchHit[], limit: number) {
  if (results.length >= limit) return
  let entries: Dirent[]
  try {
    entries = await fs.readdir(safePath(dirPath), { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (results.length >= limit) return
    if (entry.name.startsWith('.') || entry.name === '_sections') continue

    const rel = joinStoragePath(dirPath, entry.name)
    if (entry.isDirectory()) {
      await collectSearchResults(rel, query, results, limit)
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const pagePath = normalizePagePath(rel)
    if (!pagePath) continue

    try {
      const file = await readPageMarkdownByPath(rel)
      const haystack = `${String(file.frontmatter.title ?? '')}\n${file.content}`.toLowerCase()
      if (!haystack.includes(query)) continue

      const lines = file.content.split(/\r?\n/)
      const matches = lines
        .map((line, index) => ({ line: index + 1, snippet: line.trim() }))
        .filter((line) => line.snippet.toLowerCase().includes(query))
        .slice(0, 3)
      results.push({
        id: pageIdFromFrontmatter(file.frontmatter),
        path: pagePath,
        title: String(file.frontmatter.title ?? pageTitleFromPath(pagePath)),
        type: file.frontmatter.kanban === true ? 'board' : 'page',
        matches: matches.length ? matches : [{ line: 1, snippet: String(file.frontmatter.title ?? pageTitleFromPath(pagePath)) }],
      })
    } catch {
      // Skip unreadable files.
    }
  }
}

async function searchPages(query: string, limit: number) {
  const cleanQuery = query.trim().toLowerCase()
  if (!cleanQuery) throw new AppError(400, 'Missing query')
  const results: SearchHit[] = []
  await collectSearchResults('', cleanQuery, results, Math.min(Math.max(limit, 1), 50))
  return results
}

async function readAgentInstructions() {
  try {
    return await fs.readFile(safePath('_AGENT.md'), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'No workspace _AGENT.md instructions have been created yet.'
    throw error
  }
}

function resourceText(uri: string, text: string, mimeType = 'text/plain'): ReadResourceResult {
  return { contents: [{ uri, mimeType, text }] }
}

function pagePathFromResourceUri(uri: URL) {
  return decodeURIComponent(uri.pathname.replace(/^\/+/, ''))
}

export function createWikindieMcpServer(user: SessionUser) {
  const server = new McpServer({ name: 'wikindie', version: '0.6.0' })

  server.registerTool('get_tree', { title: 'Get Tree', description: 'List the Wikindie page tree.', inputSchema: {} }, async () => {
    assertPermission(user, 'read')
    return toolResult({ tree: await buildTree() })
  })

  server.registerTool(
    'search_pages',
    {
      title: 'Search Pages',
      description: 'Search Markdown page titles and content using a simple case-insensitive substring search.',
      inputSchema: {
        query: z.string().describe('Text to search for'),
        limit: z.number().int().min(1).max(50).default(10).optional(),
      },
    },
    async ({ query, limit = 10 }) => {
      assertPermission(user, 'read')
      return toolResult({ pages: await searchPages(query, limit) })
    },
  )

  server.registerTool(
    'get_page',
    { title: 'Get Page', description: 'Read a page by path or stable id.', inputSchema: pageIdentifierSchema },
    async (input) => {
      assertPermission(user, 'read')
      return toolResult(await readPageFromIdentifier(input))
    },
  )

  server.registerTool(
    'create_page',
    {
      title: 'Create Page',
      description: 'Create a page or kanban board, optionally below a parent page.',
      inputSchema: {
        parentPath: z.string().optional(),
        parentId: z.string().optional(),
        name: z.string().min(1),
        type: z.enum(['page', 'board']).default('page').optional(),
      },
    },
    async ({ parentPath, parentId, name, type = 'page' }) => {
      assertPermission(user, 'write')
      const path = parentId || parentPath ? await createChildPage(await pagePathFromIdentifier({ id: parentId, path: parentPath }), name, type === 'board') : await createPage(name, type === 'board')
      return toolResult({ page: await readPage(path) })
    },
  )

  server.registerTool(
    'update_page',
    {
      title: 'Update Page',
      description: 'Replace page Markdown content and frontmatter. The stable page id is preserved.',
      inputSchema: {
        ...pageIdentifierSchema,
        content: z.string(),
        frontmatter: z.record(z.string(), z.unknown()).default({}).optional(),
      },
    },
    async ({ content, frontmatter = {}, ...input }) => {
      assertPermission(user, 'write')
      const pagePath = await pagePathFromIdentifier(input)
      return toolResult(await writePage(pagePath, content, frontmatter))
    },
  )

  server.registerTool(
    'patch_page_meta',
    {
      title: 'Patch Page Metadata',
      description: 'Merge frontmatter metadata into a page. The stable page id is preserved.',
      inputSchema: { ...pageIdentifierSchema, patch: z.record(z.string(), z.unknown()) },
    },
    async ({ patch, ...input }) => {
      assertPermission(user, 'write')
      return toolResult(await updatePageMeta(await pagePathFromIdentifier(input), patch))
    },
  )

  server.registerTool(
    'move_page',
    { title: 'Move Page', description: 'Move or rename a page. The stable page id stays with the page.', inputSchema: { ...pageIdentifierSchema, newPath: z.string().min(1) } },
    async ({ newPath, ...input }) => {
      assertPermission(user, 'write')
      const fromPath = await pagePathFromIdentifier(input)
      await movePage(fromPath, newPath)
      return toolResult({ page: await readPage(newPath) })
    },
  )

  server.registerTool(
    'delete_page',
    { title: 'Delete Page', description: 'Delete a page. Requires admin role.', inputSchema: pageIdentifierSchema },
    async (input) => {
      assertPermission(user, 'delete')
      const pagePath = await pagePathFromIdentifier(input)
      await deletePage(pagePath)
      return toolResult({ ok: true, path: pagePath })
    },
  )

  server.registerTool(
    'upsert_section',
    {
      title: 'Upsert Section',
      description: 'Create or update a page section file and frontmatter section reference.',
      inputSchema: { ...pageIdentifierSchema, sectionPath: z.string().min(1), title: z.string().min(1), content: z.string().default('').optional() },
    },
    async ({ sectionPath, title, content = '', ...input }) => {
      assertPermission(user, 'write')
      return toolResult(await upsertSection(await pagePathFromIdentifier(input), sectionPath, title, content))
    },
  )

  server.registerTool(
    'delete_section',
    { title: 'Delete Section', description: 'Delete a page section. Requires admin role.', inputSchema: { ...pageIdentifierSchema, sectionPath: z.string().min(1) } },
    async ({ sectionPath, ...input }) => {
      assertPermission(user, 'delete')
      return toolResult(await deleteSection(await pagePathFromIdentifier(input), sectionPath))
    },
  )

  server.registerTool(
    'get_board',
    { title: 'Get Board', description: 'Read a kanban board by path or id.', inputSchema: pageIdentifierSchema },
    async (input) => {
      assertPermission(user, 'read')
      const page = await readPageFromIdentifier(input)
      return toolResult({ ...page, board: boardForPage(page) })
    },
  )

  const taskCommentSchema = z.object({
    id: z.string().optional(),
    author: z.string().optional(),
    body: z.string(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    editedBy: z.string().optional(),
  })

  const kanbanCardSchema = z.object({
    uid: z.string().optional(),
    id: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    comments: z.array(taskCommentSchema).optional(),
    priority: prioritySchema.optional(),
    assignees: z.array(z.string()).default([]),
    labels: z.array(z.string()).default([]),
    archived: z.boolean().optional(),
  })

  const kanbanColumnSchema = z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(['backlog', 'next', 'in_progress', 'done', 'custom']).default('custom'),
    icon: z.string().optional(),
    cards: z.array(kanbanCardSchema).default([]),
  })

  const kanbanBoardSchema = z.object({
    columns: z.array(kanbanColumnSchema),
  })

  server.registerTool(
    'save_board',
    { title: 'Save Board', description: 'Replace a complete kanban board structure.', inputSchema: { ...pageIdentifierSchema, board: kanbanBoardSchema } },
    async ({ board, ...input }) => {
      assertPermission(user, 'write')
      const page = await readPageFromIdentifier(input)
      boardForPage(page)
      return toolResult(await writeBoard(page, board as KanbanBoard))
    },
  )

  server.registerTool(
    'list_tasks',
    {
      title: 'List Tasks',
      description: 'List tasks from one board/page scope or all boards when no path/id is provided.',
      inputSchema: {
        ...pageIdentifierSchema,
        status: z.string().optional().describe('Column status or column id'),
        priority: prioritySchema.optional(),
        assignee: z.string().optional(),
        label: z.string().optional(),
        includeArchived: z.boolean().default(false).optional(),
      },
    },
    async (input) => {
      assertPermission(user, 'read')
      return toolResult(await listTasks(input))
    },
  )

  server.registerTool(
    'get_task',
    { title: 'Get Task', description: 'Find a task by task id, optionally constrained to one board.', inputSchema: { ...boardLocationSchema, taskId: z.string().min(1) } },
    async ({ taskId, ...location }) => {
      assertPermission(user, 'read')
      const result = await resolveTaskBoard(taskId, location)
      return toolResult({ task: result.card, boardPath: result.page.path, boardId: result.page.id, columnId: result.column.id })
    },
  )

  server.registerTool(
    'create_task',
    {
      title: 'Create Task',
      description: 'Create a kanban card in a board column. If task IDs are enabled, an id is assigned on save.',
      inputSchema: {
        ...boardLocationSchema,
        columnId: z.string().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        priority: prioritySchema.optional(),
        assignees: z.array(z.string()).default([]).optional(),
        labels: z.array(z.string()).default([]).optional(),
      },
    },
    async ({ columnId, ...input }) => {
      assertPermission(user, 'write')
      const page = await readPage(await boardPathFromLocation(input))
      const board = boardForPage(page)
      const column = (columnId ? board.columns.find((item) => item.id === columnId) : board.columns[0]) ?? board.columns[0]
      if (!column) throw new AppError(400, 'Board has no columns')
      column.cards.push(makeCard(input))
      const updated = await writeBoard(page, board)
      return toolResult(updated)
    },
  )

  server.registerTool(
    'update_task',
    {
      title: 'Update Task',
      description: 'Update task fields by task id.',
      inputSchema: {
        ...boardLocationSchema,
        taskId: z.string().min(1),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: prioritySchema.optional().nullable(),
        assignees: z.array(z.string()).optional(),
        labels: z.array(z.string()).optional(),
        archived: z.boolean().optional(),
      },
    },
    async ({ taskId, title, description, priority, assignees, labels, archived, ...location }) => {
      assertPermission(user, 'write')
      if (labels) assertNoReservedLabels(labels)
      const result = await resolveTaskBoard(taskId, location)
      if (title !== undefined) result.card.title = title
      if (description !== undefined) result.card.description = description || undefined
      if (priority !== undefined) result.card.priority = priority ?? undefined
      if (assignees !== undefined) result.card.assignees = assignees
      if (labels !== undefined) result.card.labels = labels
      if (archived !== undefined) result.card.archived = archived || undefined
      return toolResult(await writeBoard(result.page, result.board))
    },
  )

  const taskCommentLocatorSchema = {
    ...boardLocationSchema,
    taskId: z.string().optional(),
    cardUid: z.string().optional(),
    columnId: z.string().optional(),
    index: z.number().int().min(0).optional(),
  }

  server.registerTool(
    'add_task_comment',
    {
      title: 'Add Task Comment',
      description: 'Add a generic comment to a kanban task. Requires editor role.',
      inputSchema: { ...taskCommentLocatorSchema, body: z.string().min(1) },
    },
    async ({ body, ...input }) => {
      assertPermission(user, 'write')
      const page = await readPage(await boardPathFromLocation(input))
      const board = boardForPage(page)
      const match = findKanbanCard(board, input)
      if (!match) throw notFound('Task not found')
      if (!match.card.uid) match.card.uid = generateCardUid()
      const comment = createTaskComment(requireCommentBody(body), user.username)
      match.card.comments = [...(match.card.comments ?? []), comment]
      const updated = await writeBoard(page, board)
      return toolResult({ comment, task: match.card, boardPath: page.path, boardId: page.id, columnId: match.column.id, page: updated })
    },
  )

  server.registerTool(
    'update_task_comment',
    {
      title: 'Update Task Comment',
      description: 'Edit a task comment by comment id. Requires editor role.',
      inputSchema: { ...boardLocationSchema, commentId: z.string().min(1), body: z.string().min(1) },
    },
    async ({ commentId, body, ...location }) => {
      assertPermission(user, 'write')
      const page = await readPage(await boardPathFromLocation(location))
      const board = boardForPage(page)
      const match = findKanbanComment(board, commentId)
      if (!match) throw notFound('Comment not found')
      match.comment.body = requireCommentBody(body)
      match.comment.updatedAt = new Date().toISOString()
      match.comment.editedBy = user.username
      const updated = await writeBoard(page, board)
      return toolResult({ comment: match.comment, task: match.card, boardPath: page.path, boardId: page.id, columnId: match.column.id, page: updated })
    },
  )

  server.registerTool(
    'delete_task_comment',
    {
      title: 'Delete Task Comment',
      description: 'Remove a task comment by comment id. Requires editor role.',
      inputSchema: { ...boardLocationSchema, commentId: z.string().min(1) },
    },
    async ({ commentId, ...location }) => {
      assertPermission(user, 'write')
      const page = await readPage(await boardPathFromLocation(location))
      const board = boardForPage(page)
      const match = findKanbanComment(board, commentId)
      if (!match || !match.card.comments) throw notFound('Comment not found')
      const [comment] = match.card.comments.splice(match.commentIndex, 1)
      if (!match.card.comments.length) match.card.comments = undefined
      const updated = await writeBoard(page, board)
      return toolResult({ comment, task: match.card, boardPath: page.path, boardId: page.id, columnId: match.column.id, page: updated })
    },
  )

  const moveTaskInputSchema = { ...boardLocationSchema, taskId: z.string().min(1), columnId: z.string().min(1), index: z.number().int().min(0).optional() }
  const moveTaskHandler = async ({ taskId, columnId, index, ...location }: { taskId: string; columnId: string; index?: number; boardPath?: string; boardId?: string }) => {
    assertPermission(user, 'write')
    const result = await resolveTaskBoard(taskId, location)
    const targetColumn = result.board.columns.find((column) => column.id === columnId)
    if (!targetColumn) throw notFound('Column not found')
    result.column.cards.splice(result.cardIndex, 1)
    targetColumn.cards.splice(index ?? targetColumn.cards.length, 0, result.card)
    return toolResult(await writeBoard(result.page, result.board))
  }

  server.registerTool('move_task', { title: 'Move Task', description: 'Move a task to another column on the same board.', inputSchema: moveTaskInputSchema }, moveTaskHandler)
  server.registerTool('move_card', { title: 'Move Card', description: 'Alias for move_task.', inputSchema: moveTaskInputSchema }, moveTaskHandler)

  server.registerTool(
    'archive_task',
    { title: 'Archive Task', description: 'Set or clear a task archived flag.', inputSchema: { ...boardLocationSchema, taskId: z.string().min(1), archived: z.boolean().default(true).optional() } },
    async ({ taskId, archived = true, ...location }) => {
      assertPermission(user, 'write')
      const result = await resolveTaskBoard(taskId, location)
      result.card.archived = archived || undefined
      return toolResult(await writeBoard(result.page, result.board))
    },
  )

  server.registerTool('get_stats', { title: 'Get Stats', description: 'Read workspace statistics.', inputSchema: {} }, async () => {
    assertPermission(user, 'read')
    return toolResult({ stats: await readWorkspaceStats() })
  })

  const recentsInputSchema = { limit: z.number().int().min(1).max(50).default(10).optional() }
  const recentsHandler = async ({ limit = 10 }: { limit?: number }) => {
    assertPermission(user, 'read')
    return toolResult({ pages: await readRecentPages(limit) })
  }

  server.registerTool('get_recents', { title: 'Get Recent Pages', description: 'List recently modified pages.', inputSchema: recentsInputSchema }, recentsHandler)
  server.registerTool('get_activity', { title: 'Get Activity', description: 'Alias for get_recents.', inputSchema: recentsInputSchema }, recentsHandler)

  server.registerResource('workspace-tree', 'wikindie://workspace/tree', { title: 'Workspace Tree', mimeType: 'application/json' }, async (uri) => {
    assertPermission(user, 'read')
    return resourceText(uri.href, JSON.stringify({ tree: await buildTree() }, null, 2), 'application/json')
  })

  server.registerResource('workspace-stats', 'wikindie://workspace/stats', { title: 'Workspace Stats', mimeType: 'application/json' }, async (uri) => {
    assertPermission(user, 'read')
    return resourceText(uri.href, JSON.stringify({ stats: await readWorkspaceStats() }, null, 2), 'application/json')
  })

  server.registerResource('agent-instructions', 'wikindie://workspace/agent-instructions', { title: 'Workspace Agent Instructions', mimeType: 'text/markdown' }, async (uri) => {
    assertPermission(user, 'read')
    return resourceText(uri.href, await readAgentInstructions(), 'text/markdown')
  })

  server.registerResource(
    'page',
    new ResourceTemplate('wikindie://page/{path}', { list: undefined }),
    { title: 'Page', mimeType: 'application/json' },
    async (uri) => {
      assertPermission(user, 'read')
      return resourceText(uri.href, JSON.stringify(await readPage(pagePathFromResourceUri(uri)), null, 2), 'application/json')
    },
  )

  server.registerResource(
    'board-tasks',
    new ResourceTemplate('wikindie://board/{path}/tasks', { list: undefined }),
    { title: 'Board Tasks', mimeType: 'application/json' },
    async (uri) => {
      assertPermission(user, 'read')
      const path = decodeURIComponent(uri.pathname.replace(/^\/+/, '').replace(/\/tasks$/, ''))
      return resourceText(uri.href, JSON.stringify(await readTaskOverview(path), null, 2), 'application/json')
    },
  )

  server.registerPrompt('wikindie_workspace_brief', { title: 'Workspace Brief', description: 'Summarize the current Wikindie workspace.' }, async (): Promise<GetPromptResult> => ({
    messages: [{ role: 'user', content: { type: 'text', text: 'Review the Wikindie workspace tree, recent pages, stats, and open tasks. Give me a concise project brief with the most important current work.' } }],
  }))

  server.registerPrompt('wikindie_plan_project', { title: 'Plan Project', description: 'Create a project page and task plan.' }, async (): Promise<GetPromptResult> => ({
    messages: [{ role: 'user', content: { type: 'text', text: 'Help me plan a project in Wikindie. Create or update a project page with goals, scope, risks, and a kanban task breakdown.' } }],
  }))

  server.registerPrompt('wikindie_triage_tasks', { title: 'Triage Tasks', description: 'Review and prioritize kanban tasks.' }, async (): Promise<GetPromptResult> => ({
    messages: [{ role: 'user', content: { type: 'text', text: 'Review Wikindie kanban tasks. Identify blocked, stale, high-priority, and ready-next tasks, then recommend concrete updates.' } }],
  }))

  server.registerTool('get_agent_instructions', { title: 'Get Agent Instructions', description: 'Read workspace _AGENT.md instructions if present.', inputSchema: {} }, async () => {
    assertPermission(user, 'read')
    return textToolResult(await readAgentInstructions())
  })

  return server
}
