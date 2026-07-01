import { useAuthStore, useRuntimeConfigStore } from './store'
import type { Role, RuntimeConfig } from './store'

export interface MarkdownFile {
  content: string
  frontmatter: Record<string, unknown>
}

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

export interface PageSection {
  title: string
  path: string
  content: string
}

export interface PageBundle extends MarkdownFile {
  id: string
  path: string
  type: 'page' | 'board'
  diskSizeBytes: number
  sections: PageSection[]
  board?: KanbanBoard
}

export type CardPriority = 'high' | 'medium' | 'low'
export type KanbanColumnStatus = 'backlog' | 'next' | 'in_progress' | 'done' | 'custom'

export interface TaskComment {
  id: string
  author?: string
  body: string
  createdAt: string
  updatedAt?: string
  editedBy?: string
}

export interface AttachmentMeta {
  id: string
  pageId: string
  filename: string
  contentType: string
  size: number
  createdAt: string
  url: string
}

export interface KanbanCard {
  uid?: string
  id?: string
  title: string
  description?: string
  comments?: TaskComment[]
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
  id?: string
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
  uid?: string
  id?: string
  title: string
  description?: string
  comments?: TaskComment[]
  priority?: CardPriority
  assignees: string[]
  labels: string[]
  archived?: boolean
  boardId?: string
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
  imageCount: number
  imageDiskSizeBytes: number
}

export interface TaskIdSettings {
  enabled: boolean
  prefix: string
}

export interface RecentPage {
  id?: string
  path: string
  title: string
  icon?: string
  mtime: string
  type: 'page' | 'board'
}

export interface ApiKeyRecord {
  id: string
  prefix: string
  userId: string
  role: Role
  label: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

function buildAuthHeaders(authToken: string | null, headers?: HeadersInit) {
  const result = new Headers(headers)
  if (authToken) result.set('Authorization', `Bearer ${authToken}`)
  return result
}

function errorFromResponse(res: Response) {
  return res.json().then((body) => new Error(body.error ?? 'Request failed')).catch(() => new Error(res.statusText || 'Request failed'))
}

async function binaryRequest(path: string, init: RequestInit = {}) {
  const token = useAuthStore.getState().token
  let res = await fetch(path, {
    ...init,
    headers: buildAuthHeaders(token, init.headers),
  })

  if (res.status === 401) {
    if (token) useAuthStore.getState().logout()
    const method = String(init.method ?? 'GET').toUpperCase()
    if (token && useRuntimeConfigStore.getState().config?.publicReadonly && (method === 'GET' || method === 'HEAD')) {
      res = await fetch(path, { ...init, headers: buildAuthHeaders(null, init.headers) })
    }
  }

  if (!res.ok) throw await errorFromResponse(res)
  return res
}

export function isAttachmentUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin)
    // Must be same-origin: otherwise a page could point an "attachment" at an
    // attacker host and we would fetch it with the user's bearer token attached.
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/attachments/')
  } catch {
    return false
  }
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
  apiKeys: () => request<{ keys: ApiKeyRecord[] }>('/api/auth/apikeys'),
  generateApiKey: (label: string, role: Role) =>
    request<{ key: string; record: ApiKeyRecord }>('/api/auth/apikeys', {
      method: 'POST',
      body: JSON.stringify({ label, role }),
    }),
  revokeApiKey: (id: string) => request<{ ok: true }>(`/api/auth/apikeys/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  deleteApiKey: (id: string) => request<{ ok: true }>(`/api/auth/apikeys/${encodeURIComponent(id)}/permanent`, { method: 'DELETE' }),
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
  createPage: (name: string, parentPath?: string, type: 'page' | 'board' = 'page', icon?: string) =>
    request<{ path: string }>('/api/pages', {
      method: 'POST',
      body: JSON.stringify({ name, parentPath, type, icon }),
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
  addTaskComment: (path: string, input: { taskId?: string; cardUid?: string; columnId?: string; index?: number; body: string }) =>
    request<PageBundle & { board: KanbanBoard; comment: TaskComment; card: KanbanCard }>(`/api/kanban-comments/${encodePath(path)}`, { method: 'POST', body: JSON.stringify(input) }),
  updateTaskComment: (path: string, commentId: string, body: string) =>
    request<PageBundle & { board: KanbanBoard; comment: TaskComment; card: KanbanCard }>(`/api/kanban-comments/${encodePath(path)}`, { method: 'PATCH', body: JSON.stringify({ commentId, body }) }),
  deleteTaskComment: (path: string, commentId: string) =>
    request<PageBundle & { board: KanbanBoard; comment: TaskComment; card: KanbanCard }>(`/api/kanban-comments/${encodePath(path)}`, { method: 'DELETE', body: JSON.stringify({ commentId }) }),
  uploadAttachment: async (pageId: string, file: File) => {
    const res = await binaryRequest(`/api/attachments/${encodeURIComponent(pageId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Wikindie-Filename': file.name,
        'X-Wikindie-Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    })
    return (await res.json()) as { attachment: AttachmentMeta }
  },
  attachmentBlob: async (url: string) => {
    if (!isAttachmentUrl(url)) throw new Error('Refusing to fetch non-attachment URL')
    return (await binaryRequest(url)).blob()
  },
  recents: (limit = 10) => request<{ pages: RecentPage[] }>(`/api/recents?limit=${limit}`),
  stats: () => request<{ stats: WorkspaceStats }>('/api/stats'),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ ok: true }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
