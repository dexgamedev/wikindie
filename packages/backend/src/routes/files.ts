import { Router } from 'express'
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
import { normalizeKanbanBoard, parseKanban, parseKanbanColumnMetadata, parseTaskIdSettings, serializeKanban, withKanbanColumnMetadata } from '../lib/kanban.js'
import { AppError } from '../lib/errors.js'
import { requirePermission } from '../middleware/permissions.js'
import { listUsers } from '../lib/users.js'

export const filesRouter = Router()

const joinedPath = (value: unknown) => (Array.isArray(value) ? value.join('/') : String(value ?? ''))

const boardForPage = (page: Awaited<ReturnType<typeof readPage>>) =>
  normalizeKanbanBoard(parseKanban(page.content), parseTaskIdSettings(page.frontmatter), parseKanbanColumnMetadata(page.frontmatter))

filesRouter.get('/tree', requirePermission('read'), async (_req, res) => {
  res.json({ tree: await buildTree() })
})

filesRouter.get('/users', requirePermission('read'), async (_req, res) => {
  const users = await listUsers()
  res.json({ users: users.map((user) => ({ username: user.username })) })
})

filesRouter.get('/kanban/*path', requirePermission('read'), async (req, res) => {
  const page = await readPage(joinedPath(req.params.path))
  res.json({ ...page, board: boardForPage(page) })
})

filesRouter.put('/kanban/*path', requirePermission('write'), async (req, res) => {
  const { board } = req.body as { board?: ReturnType<typeof parseKanban> }
  if (!board) throw new AppError(400, 'Missing board')
  const page = await readPage(joinedPath(req.params.path))
  const frontmatter = { ...page.frontmatter, kanban: true }
  const normalized = normalizeKanbanBoard(board, parseTaskIdSettings(frontmatter), parseKanbanColumnMetadata(frontmatter), false)
  const updated = await writePage(page.path, serializeKanban(normalized), withKanbanColumnMetadata(frontmatter, normalized))
  res.json({ ...updated, board: normalized })
})

filesRouter.get('/page/*path/tasks', requirePermission('read'), async (req, res) => {
  res.json(await readTaskOverview(joinedPath(req.params.path)))
})

filesRouter.get('/page/*path', requirePermission('read'), async (req, res) => {
  const page = await readPage(joinedPath(req.params.path))
  if (page.type === 'board') {
    res.json({ ...page, board: boardForPage(page) })
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
