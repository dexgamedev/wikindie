import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { SPACE_DIR, safePath } from './files.js'

export interface TreeNode {
  name: string
  title: string
  path: string
  type: 'page' | 'board'
  icon?: string
  children?: TreeNode[]
}

async function readFrontmatter(relativePath: string) {
  try {
    const raw = await fs.readFile(safePath(relativePath), 'utf8')
    return matter(raw).data as Record<string, unknown>
  } catch {
    return {}
  }
}

function displayNameFromPath(relativePath: string) {
  const parts = relativePath.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : 'Home'
}

function sortNodes(nodes: TreeNode[]) {
  return nodes.sort((a, b) => a.title.localeCompare(b.title))
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
        const children = await buildTree(rel)
        nodes.push({
          name: entry.name,
          title: String(frontmatter.title ?? entry.name),
          path: rel,
          type: frontmatter.kanban === true ? 'board' : 'page',
          icon: typeof frontmatter.icon === 'string' ? frontmatter.icon : undefined,
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
    const name = displayNameFromPath(pagePath)
    nodes.push({
      name,
      title: String(frontmatter.title ?? name),
      path: pagePath,
      type: frontmatter.kanban === true ? 'board' : 'page',
      icon: typeof frontmatter.icon === 'string' ? frontmatter.icon : undefined,
      children: [],
    })
  }

  return sortNodes(nodes)
}
