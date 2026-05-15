import { useAuthStore, useRuntimeConfigStore } from './store'
import type { Role, RuntimeConfig } from './store'

export interface MarkdownFile {
  content: string
  frontmatter: Record<string, unknown>
}

export interface TreeNode {
  name: string
  title: string
  path: string
  type: 'page' | 'board'
  icon?: string
  children?: TreeNode[]
}

export interface PageSection {
  title: string
  path: string
  content: string
}

export interface PageBundle extends MarkdownFile {
  path: string
  type: 'page' | 'board'
  diskSizeBytes: number
  sections: PageSection[]
  board?: KanbanBoard
}

export type CardPriority = 'high' | 'medium' | 'low'
export type KanbanColumnStatus = 'backlog' | 'next' | 'in_progress' | 'done' | 'custom'

export interface KanbanCard {
  id?: string
  title: string
  description?: string
  priority?: CardPriority
  assignees: string[]
  labels: string[]
  archived?: boolean
}

export interface KanbanColumn {
  id: string
  title: string
  status: KanbanColumnStatus
  icon?: string
  cards: KanbanCard[]
}

export interface KanbanBoard {
  columns: KanbanColumn[]
}

export interface BoardSummaryColumn {
  id: string
  title: string
  status: KanbanColumnStatus
  icon?: string
  total: number
  active: number
  done: number
  archived: number
}

export interface BoardSummary {
  path: string
  title: string
  icon?: string
  columns: BoardSummaryColumn[]
  totalCards: number
  activeCards: number
  doneCards: number
  archivedCards: number
}

export interface TaskInfo {
  id?: string
  title: string
  description?: string
  priority?: CardPriority
  assignees: string[]
  labels: string[]
  archived?: boolean
  boardPath: string
  boardTitle: string
  columnId: string
  columnTitle: string
  columnStatus: KanbanColumnStatus
  columnIcon?: string
}

export type TaskOverviewScope = 'board' | 'page'

export interface TaskOverview {
  scope: TaskOverviewScope
  boards: BoardSummary[]
  tasks: TaskInfo[]
}

export interface WorkspaceStats {
  totalPages: number
  totalBoards: number
  totalTasks: number
  doneTasks: number
  archivedTasks: number
  diskSizeBytes: number
}

export interface TaskIdSettings {
  enabled: boolean
  prefix: string
}

export interface RecentPage {
  path: string
  title: string
  icon?: string
  mtime: string
  type: 'page' | 'board'
}

export function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const buildHeaders = (authToken: string | null) => ({
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...init.headers,
  })
  let res = await fetch(path, {
    ...init,
    headers: buildHeaders(token),
  })

  if (res.status === 401) {
    if (token) useAuthStore.getState().logout()
    const method = String(init.method ?? 'GET').toUpperCase()
    if (token && useRuntimeConfigStore.getState().config?.publicReadonly && (method === 'GET' || method === 'HEAD')) {
      res = await fetch(path, { ...init, headers: buildHeaders(null) })
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? 'Request failed')
  }
  return res.json() as Promise<T>
}

export const api = {
  config: () => request<RuntimeConfig>('/api/config'),
  login: (username: string, password: string) =>
    request<{ token: string; user: { id: string; username: string; role: Role } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  tree: () => request<{ tree: TreeNode[] }>('/api/tree'),
  users: () => request<{ users: { username: string }[] }>('/api/users'),
  page: (path: string) => request<PageBundle>(`/api/page/${encodePath(path)}`),
  taskOverview: (path: string) => request<TaskOverview>(`/api/page/${encodePath(path)}/tasks`),
  writePage: (path: string, content: string, frontmatter: Record<string, unknown>) =>
    request<PageBundle>(`/api/page/${encodePath(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ content, frontmatter }),
    }),
  patchPageMeta: (path: string, patch: Record<string, unknown>) =>
    request<PageBundle>(`/api/page/${encodePath(path)}/meta`, {
      method: 'PATCH',
      body: JSON.stringify({ patch }),
    }),
  createPage: (name: string, parentPath?: string, type: 'page' | 'board' = 'page') =>
    request<{ path: string }>('/api/pages', {
      method: 'POST',
      body: JSON.stringify({ name, parentPath, type }),
    }),
  removePage: (path: string) => request<{ ok: true }>(`/api/page/${encodePath(path)}`, { method: 'DELETE' }),
  movePage: (path: string, newPath: string) =>
    request<{ ok: true }>(`/api/page/${encodePath(path)}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ newPath }),
    }),
  upsertSection: (path: string, sectionPath: string, title: string, content: string) =>
    request<PageBundle>(`/api/sections/${encodePath(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ sectionPath, title, content }),
    }),
  deleteSection: (path: string, sectionPath: string) =>
    request<PageBundle>(`/api/sections/${encodePath(path)}`, {
      method: 'DELETE',
      body: JSON.stringify({ sectionPath }),
    }),
  kanban: (path: string) => request<PageBundle & { board: KanbanBoard }>(`/api/kanban/${encodePath(path)}`),
  saveKanban: (path: string, board: KanbanBoard) =>
    request<PageBundle & { board: KanbanBoard }>(`/api/kanban/${encodePath(path)}`, { method: 'PUT', body: JSON.stringify({ board }) }),
  recents: (limit = 10) => request<{ pages: RecentPage[] }>(`/api/recents?limit=${limit}`),
  stats: () => request<{ stats: WorkspaceStats }>('/api/stats'),
}
