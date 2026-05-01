import { encodePath, type TreeNode } from './api'

export function pageUrl(path: string) {
  return `/page/${encodePath(path)}`
}

export function pageNameFromPath(pagePath: string) {
  const parts = pagePath.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : 'Home'
}

export function breadcrumbsFromPath(pagePath: string) {
  const parts = pagePath.split('/').filter(Boolean)
  return parts.map((label, index) => ({
    label,
    path: parts.slice(0, index + 1).join('/'),
  }))
}

export function findTreeNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node
    const match = node.children ? findTreeNode(node.children, path) : undefined
    if (match) return match
  }
  return undefined
}

export function goBack(navigate: { (delta: number): void; (to: string): void }) {
  if (window.history.length > 1) navigate(-1)
  else navigate('/')
}
