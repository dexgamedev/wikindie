import fs from 'node:fs/promises'
import path from 'node:path'
import { SPACE_DIR, isHiddenPage, pageIdFromFrontmatter, readPageMarkdownByPath, safePath } from './files.js'

export interface TreeNode {
  id?: string
  name: string
  title: string
  path: string
  type: 'page' | 'board'
  icon?: string
  order?: number
  children?: TreeNode[]
}

async function readFrontmatter(relativePath: string) {
  try {
    return (await readPageMarkdownByPath(relativePath)).frontmatter
  } catch {
    return {}
  }
}

function displayNameFromPath(relativePath: string) {
  const parts = relativePath.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : 'Home'
}

function orderFromFrontmatter(frontmatter: Record<string, unknown>) {
  const order = Number(frontmatter.order)
  return Number.isFinite(order) ? order : undefined
}

function sortNodes(nodes: TreeNode[]) {
  return nodes.sort((a, b) => {
    const orderA = a.order ?? Number.POSITIVE_INFINITY
    const orderB = b.order ?? Number.POSITIVE_INFINITY
    return orderA - orderB || a.title.localeCompare(b.title)
  })
}

export async function buildTree(relativePath = ''): Promise<TreeNode[]> {
  const dir = safePath(relativePath)
  const entries = await fs.readdir(dir, { withFileTypes: true })

  const nodes: TreeNode[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const rel = path.relative(SPACE_DIR, path.join(dir, entry.name)).replaceAll(path.sep, '/')
    if (entry.isDirectory()) {
      if (entry.name === '_sections') continue
      const indexPath = `${rel}/_Index.md`
      try {
        await fs.stat(safePath(indexPath))
        const frontmatter = await readFrontmatter(indexPath)
        if (isHiddenPage(indexPath, frontmatter)) continue
        const children = await buildTree(rel)
        const order = orderFromFrontmatter(frontmatter)
        nodes.push({
          id: pageIdFromFrontmatter(frontmatter),
          name: entry.name,
          title: String(frontmatter.title ?? entry.name),
          path: rel,
          type: frontmatter.kanban === true ? 'board' : 'page',
          icon: typeof frontmatter.icon === 'string' ? frontmatter.icon : undefined,
          ...(order !== undefined ? { order } : {}),
          children,
        })
      } catch {
        const flattened = await buildTree(rel)
        nodes.push(...flattened)
      }
      continue
    }

    if (!entry.name.endsWith('.md') || entry.name === '_Index.md') continue
    const pagePath = rel.replace(/\.md$/, '')
    const frontmatter = await readFrontmatter(rel)
    if (isHiddenPage(rel, frontmatter)) continue
    const name = displayNameFromPath(pagePath)
    const order = orderFromFrontmatter(frontmatter)
    nodes.push({
      id: pageIdFromFrontmatter(frontmatter),
      name,
      title: String(frontmatter.title ?? name),
      path: pagePath,
      type: frontmatter.kanban === true ? 'board' : 'page',
      icon: typeof frontmatter.icon === 'string' ? frontmatter.icon : undefined,
      ...(order !== undefined ? { order } : {}),
      children: [],
    })
  }

  return sortNodes(nodes)
}
