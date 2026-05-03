import type { TreeNode } from './api'

export interface PageDragPayload {
  path: string
  type: TreeNode['type']
}

const pageDragType = 'application/x-wikindie-page'

export function hasPageDragPayload(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes(pageDragType)
}

export function setPageDragPayload(dataTransfer: DataTransfer, payload: PageDragPayload) {
  dataTransfer.effectAllowed = 'move'
  dataTransfer.setData(pageDragType, JSON.stringify(payload))
}

export function getPageDragPayload(dataTransfer: DataTransfer): PageDragPayload | null {
  const raw = dataTransfer.getData(pageDragType)
  if (!raw) return null

  try {
    const payload = JSON.parse(raw) as Partial<PageDragPayload>
    if (typeof payload.path !== 'string') return null
    if (payload.type !== 'page' && payload.type !== 'board') return null
    return { path: payload.path, type: payload.type }
  } catch {
    return null
  }
}
