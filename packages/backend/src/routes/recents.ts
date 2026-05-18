import fs from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import { SPACE_DIR, normalizePagePath, pageIdFromFrontmatter, readPageMarkdownByPath } from '../lib/files.js'

export const recentsRouter = Router()

export interface RecentPage {
  id?: string
  path: string
  title: string
  icon?: string
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
      const [file, stat] = await Promise.all([readPageMarkdownByPath(rel, false), fs.stat(full)])
      const title = String(file.frontmatter.title ?? pagePath.split('/').at(-1) ?? pagePath)
      const type = file.frontmatter.kanban === true ? 'board' : 'page'
      const icon = typeof file.frontmatter.icon === 'string' ? file.frontmatter.icon : undefined
      pages.push({ id: pageIdFromFrontmatter(file.frontmatter), path: pagePath, title, icon, mtime: stat.mtime.toISOString(), type })
    } catch {
    }
  }
}

export async function readRecentPages(limit = 10) {
  const pages: RecentPage[] = []
  await collectPages(SPACE_DIR, pages)
  pages.sort((a, b) => b.mtime.localeCompare(a.mtime))
  return pages.slice(0, Math.min(limit, 50))
}

recentsRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 10), 50)
  res.json({ pages: await readRecentPages(limit) })
})
