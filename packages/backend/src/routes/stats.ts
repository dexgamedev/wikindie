import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { Router } from 'express'
import { SPACE_DIR } from '../lib/files.js'
import { parseKanban } from '../lib/kanban.js'

export const statsRouter = Router()

interface WorkspaceStats {
  totalPages: number
  totalBoards: number
  totalTasks: number
  doneTasks: number
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
      await collectStats(full, stats)
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue

    try {
      const [raw, fileStat] = await Promise.all([fs.readFile(full, 'utf8'), fs.stat(full)])
      stats.diskSizeBytes += fileStat.size
      const parsed = matter(raw)
      if (parsed.data.kanban === true) {
        stats.totalBoards++
        const board = parseKanban(parsed.content)
        for (const col of board.columns) {
          stats.totalTasks += col.cards.length
          stats.doneTasks += col.cards.filter((c) => c.done).length
        }
      } else {
        stats.totalPages++
      }
    } catch {
      // skip unreadable files
    }
  }
}

statsRouter.get('/', async (_req, res) => {
  const stats: WorkspaceStats = { totalPages: 0, totalBoards: 0, totalTasks: 0, doneTasks: 0, diskSizeBytes: 0 }
  await collectStats(SPACE_DIR, stats)
  res.json({ stats })
})
