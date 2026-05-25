import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { Router } from 'express'
import { SPACE_DIR, isHiddenPage, isHiddenPageDirectory } from '../lib/files.js'
import { isDoneColumn, normalizeKanbanBoard, parseKanban, parseKanbanColumnMetadata, parseTaskIdSettings } from '../lib/kanban.js'

export const statsRouter = Router()

export interface WorkspaceStats {
  totalPages: number
  totalBoards: number
  totalTasks: number
  doneTasks: number
  archivedTasks: number
  diskSizeBytes: number
}

async function collectStats(dir: string, stats: WorkspaceStats) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === '_sections') continue

    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const rel = path.relative(SPACE_DIR, full).replaceAll(path.sep, '/')
      if (await isHiddenPageDirectory(rel)) continue
      await collectStats(full, stats)
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue

    try {
      const [raw, fileStat] = await Promise.all([fs.readFile(full, 'utf8'), fs.stat(full)])
      const parsed = matter(raw)
      const rel = path.relative(SPACE_DIR, full).replaceAll(path.sep, '/')
      if (isHiddenPage(rel, parsed.data)) continue
      stats.diskSizeBytes += fileStat.size
      if (parsed.data.kanban === true) {
        stats.totalBoards++
        const board = normalizeKanbanBoard(parseKanban(parsed.content), parseTaskIdSettings(parsed.data), parseKanbanColumnMetadata(parsed.data))
        for (const col of board.columns) {
          const activeCards = col.cards.filter((card) => !card.archived)
          stats.totalTasks += activeCards.length
          stats.archivedTasks += col.cards.length - activeCards.length
          if (isDoneColumn(col)) stats.doneTasks += activeCards.length
        }
      } else {
        stats.totalPages++
      }
    } catch {
      // skip unreadable files
    }
  }
}

export async function readWorkspaceStats() {
  const stats: WorkspaceStats = { totalPages: 0, totalBoards: 0, totalTasks: 0, doneTasks: 0, archivedTasks: 0, diskSizeBytes: 0 }
  await collectStats(SPACE_DIR, stats)
  return stats
}

statsRouter.get('/', async (_req, res) => {
  const stats = await readWorkspaceStats()
  res.json({ stats })
})
