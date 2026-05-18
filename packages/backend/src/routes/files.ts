import { Router, type Request } from 'express'
import { buildTree } from '../lib/tree.js'
import {
  createChildPage,
  createPage,
  deletePage,
  deleteSection,
  movePage,
  readPage,
  readTaskOverview,
  updatePageMeta,
  upsertSection,
  writePage,
} from '../lib/files.js'
import {
  createTaskComment,
  findKanbanCard,
  findKanbanComment,
  generateCardUid,
  type KanbanBoard,
  isReservedLabelName,
  normalizeKanbanBoard,
  parseKanban,
  parseKanbanColumnMetadata,
  parseTaskComments,
  parseTaskIdSettings,
  serializeKanban,
  type TaskComment,
  withKanbanColumnMetadata,
} from '../lib/kanban.js'
import { AppError } from '../lib/errors.js'
import { requirePermission } from '../middleware/permissions.js'
import { listUsers } from '../lib/users.js'

export const filesRouter = Router()

const joinedPath = (value: unknown) => (Array.isArray(value) ? value.join('/') : String(value ?? ''))

const boardForPage = (page: Awaited<ReturnType<typeof readPage>>) =>
  normalizeKanbanBoard(parseKanban(page.content), parseTaskIdSettings(page.frontmatter), parseKanbanColumnMetadata(page.frontmatter), true, parseTaskComments(page.frontmatter))

const isGuestRequest = (req: Request) => req.user?.id === 'guest'

function redactBoardForGuest(board: KanbanBoard): KanbanBoard {
  return {
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.map((card) => ({
        ...card,
        assignees: [],
        comments: card.comments?.map((comment) => ({ ...comment, author: undefined, editedBy: undefined })),
      })),
    })),
  }
}

function redactFrontmatterForGuest(frontmatter: Record<string, unknown>) {
  const raw = frontmatter.taskComments
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return frontmatter
  const redactedComments: Record<string, TaskComment[]> = {}
  for (const [uid, comments] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(comments)) continue
    redactedComments[uid] = comments.map((comment) => {
      const { author: _author, editedBy: _editedBy, ...rest } = comment as TaskComment & Record<string, unknown>
      return rest as TaskComment
    })
  }
  return { ...frontmatter, taskComments: redactedComments }
}

function pageWithBoardForRequest(page: Awaited<ReturnType<typeof readPage>>, req: Request) {
  const board = boardForPage(page)
  if (!isGuestRequest(req)) return { ...page, board }

  const redactedBoard = redactBoardForGuest(board)
  return { ...page, content: serializeKanban(redactedBoard), frontmatter: redactFrontmatterForGuest(page.frontmatter), board: redactedBoard }
}

async function writeBoard(page: Awaited<ReturnType<typeof readPage>>, board: ReturnType<typeof parseKanban>) {
  assertNoReservedLabels(board)
  const frontmatter = { ...page.frontmatter, kanban: true }
  const normalized = normalizeKanbanBoard(board, parseTaskIdSettings(frontmatter), parseKanbanColumnMetadata(frontmatter), false, parseTaskComments(frontmatter))
  const updated = await writePage(page.path, serializeKanban(normalized), withKanbanColumnMetadata(frontmatter, normalized))
  return { ...updated, board: normalized }
}

function requireCommentBody(value: unknown) {
  const body = String(value ?? '').trim()
  if (!body) throw new AppError(400, 'Missing comment body')
  return body
}

function assertNoReservedLabels(board: ReturnType<typeof parseKanban>) {
  for (const column of board.columns ?? []) {
    for (const card of column.cards ?? []) {
      const reserved = (card.labels ?? []).find((label) => isReservedLabelName(String(label)))
      if (reserved) throw new AppError(400, `Label "${reserved}" is reserved for priority. Use the priority field instead.`)
    }
  }
}

filesRouter.get('/tree', requirePermission('read'), async (_req, res) => {
  res.json({ tree: await buildTree() })
})

filesRouter.get('/users', requirePermission('read'), async (req, res) => {
  if (isGuestRequest(req)) {
    res.json({ users: [] })
    return
  }

  const users = await listUsers()
  res.json({ users: users.map((user) => ({ username: user.username })) })
})

filesRouter.get('/kanban/*path', requirePermission('read'), async (req, res) => {
  const page = await readPage(joinedPath(req.params.path))
  res.json(pageWithBoardForRequest(page, req))
})

filesRouter.put('/kanban/*path', requirePermission('write'), async (req, res) => {
  const { board } = req.body as { board?: ReturnType<typeof parseKanban> }
  if (!board) throw new AppError(400, 'Missing board')
  const page = await readPage(joinedPath(req.params.path))
  res.json(await writeBoard(page, board))
})

filesRouter.post('/kanban-comments/*path', requirePermission('write'), async (req, res) => {
  const { taskId, cardUid, columnId, index, body } = req.body as { taskId?: string; cardUid?: string; columnId?: string; index?: number; body?: string }
  const page = await readPage(joinedPath(req.params.path))
  const board = boardForPage(page)
  const match = findKanbanCard(board, { taskId, cardUid, columnId, index })
  if (!match) throw new AppError(404, 'Task not found')
  if (!match.card.uid) match.card.uid = generateCardUid()
  const comment = createTaskComment(requireCommentBody(body), req.user?.username)
  match.card.comments = [...(match.card.comments ?? []), comment]
  const updated = await writeBoard(page, board)
  res.status(201).json({ comment, card: match.card, ...updated })
})

filesRouter.patch('/kanban-comments/*path', requirePermission('write'), async (req, res) => {
  const { commentId, body } = req.body as { commentId?: string; body?: string }
  if (!commentId) throw new AppError(400, 'Missing commentId')
  const page = await readPage(joinedPath(req.params.path))
  const board = boardForPage(page)
  const match = findKanbanComment(board, commentId)
  if (!match) throw new AppError(404, 'Comment not found')
  match.comment.body = requireCommentBody(body)
  match.comment.updatedAt = new Date().toISOString()
  match.comment.editedBy = req.user?.username
  const updated = await writeBoard(page, board)
  res.json({ comment: match.comment, card: match.card, ...updated })
})

filesRouter.delete('/kanban-comments/*path', requirePermission('write'), async (req, res) => {
  const { commentId } = req.body as { commentId?: string }
  if (!commentId) throw new AppError(400, 'Missing commentId')
  const page = await readPage(joinedPath(req.params.path))
  const board = boardForPage(page)
  const match = findKanbanComment(board, commentId)
  if (!match || !match.card.comments) throw new AppError(404, 'Comment not found')
  const [comment] = match.card.comments.splice(match.commentIndex, 1)
  if (!match.card.comments.length) match.card.comments = undefined
  const updated = await writeBoard(page, board)
  res.json({ comment, card: match.card, ...updated })
})

filesRouter.get('/page/*path/tasks', requirePermission('read'), async (req, res) => {
  const overview = await readTaskOverview(joinedPath(req.params.path))
  if (!isGuestRequest(req)) {
    res.json(overview)
    return
  }

  res.json({
    ...overview,
    tasks: overview.tasks.map((task) => ({
      ...task,
      assignees: [],
      comments: task.comments?.map((comment) => ({ ...comment, author: undefined, editedBy: undefined })),
    })),
  })
})

filesRouter.get('/page/*path', requirePermission('read'), async (req, res) => {
  const page = await readPage(joinedPath(req.params.path))
  if (page.type === 'board') {
    res.json(pageWithBoardForRequest(page, req))
    return
  }
  res.json(page)
})

filesRouter.put('/page/*path', requirePermission('write'), async (req, res) => {
  const { content, frontmatter } = req.body as { content?: string; frontmatter?: Record<string, unknown> }
  res.json(await writePage(joinedPath(req.params.path), content ?? '', frontmatter ?? {}))
})

filesRouter.patch('/page/*path/meta', requirePermission('write'), async (req, res) => {
  const { patch } = req.body as { patch?: Record<string, unknown> }
  if (!patch) throw new AppError(400, 'Missing patch')
  const updated = await updatePageMeta(joinedPath(req.params.path), patch)
  if (updated.type === 'board') {
    res.json({ ...updated, board: boardForPage(updated) })
    return
  }
  res.json(updated)
})

filesRouter.post('/pages', requirePermission('write'), async (req, res) => {
  const { parentPath, name, type } = req.body as { parentPath?: string; name?: string; type?: 'page' | 'board' }
  const cleanName = String(name ?? '').trim()
  if (!cleanName) throw new AppError(400, 'Missing name')

  let path: string
  if (parentPath && parentPath.trim()) path = await createChildPage(parentPath, cleanName, type === 'board')
  else path = await createPage(cleanName, type === 'board')
  res.status(201).json({ path })
})

filesRouter.patch('/page/*path/move', requirePermission('write'), async (req, res) => {
  const { newPath } = req.body as { newPath?: string }
  if (!newPath) throw new AppError(400, 'Missing newPath')
  await movePage(joinedPath(req.params.path), newPath)
  res.json({ ok: true })
})

filesRouter.delete('/page/*path', requirePermission('delete'), async (req, res) => {
  await deletePage(joinedPath(req.params.path))
  res.json({ ok: true })
})

filesRouter.put('/sections/*path', requirePermission('write'), async (req, res) => {
  const { sectionPath, title, content } = req.body as { sectionPath?: string; title?: string; content?: string }
  if (!sectionPath || !title) throw new AppError(400, 'Missing section data')
  res.json(await upsertSection(joinedPath(req.params.path), sectionPath, title, content ?? ''))
})

filesRouter.delete('/sections/*path', requirePermission('delete'), async (req, res) => {
  const { sectionPath } = req.body as { sectionPath?: string }
  if (!sectionPath) throw new AppError(400, 'Missing sectionPath')
  res.json(await deleteSection(joinedPath(req.params.path), sectionPath))
})
