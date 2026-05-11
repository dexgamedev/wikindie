import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { Router } from 'express'
import { SPACE_DIR, normalizePagePath } from '../lib/files.js'

export const recentsRouter = Router()

interface RecentPage {
  path: string
  title: string
  mtime: string
  type: 'page' | 'board'
}

async function collectPages(dir: string, pages: RecentPage[]) {
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
      await collectPages(full, pages)
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue

    const rel = path.relative(SPACE_DIR, full).replaceAll(path.sep, '/')
    const pagePath = normalizePagePath(rel)
    if (!pagePath) continue

    try {
      const [raw, stat] = await Promise.all([fs.readFile(full, 'utf8'), fs.stat(full)])
      const parsed = matter(raw)
      const title = String(parsed.data.title ?? pagePath.split('/').at(-1) ?? pagePath)
      const type = parsed.data.kanban === true ? 'board' : 'page'
      pages.push({ path: pagePath, title, mtime: stat.mtime.toISOString(), type })
    } catch {
      // skip unreadable files
    }
  }
}

recentsRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 10), 50)
  const pages: RecentPage[] = []
  await collectPages(SPACE_DIR, pages)
  pages.sort((a, b) => b.mtime.localeCompare(a.mtime))
  res.json({ pages: pages.slice(0, limit) })
})
