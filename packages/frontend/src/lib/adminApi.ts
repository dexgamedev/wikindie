import { request } from './api'
import type { Role } from './store'

export interface AdminUser {
  id: string
  username: string
  role: Role
  createdAt: string
  updatedAt: string
}

export interface AdminApiKey {
  id: string
  prefix: string
  userId: string
  role: Role
  label: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export const adminApi = {
  users: () => request<{ users: AdminUser[] }>('/api/admin/users'),
  createUser: (username: string, password: string, role: Role) =>
    request<{ user: AdminUser }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    }),
  deleteUser: (id: string) => request<{ ok: true }>(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  updateUserRole: (id: string, role: Role) =>
    request<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(id)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  apiKeys: () => request<{ keys: AdminApiKey[] }>('/api/admin/apikeys'),
  generateApiKey: (label: string, role: Role) =>
    request<{ key: string; record: AdminApiKey }>('/api/admin/apikeys', {
      method: 'POST',
      body: JSON.stringify({ label, role }),
    }),
  revokeApiKey: (id: string) => request<{ ok: true }>(`/api/admin/apikeys/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
