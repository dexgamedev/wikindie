import { create } from 'zustand'
import type { TreeNode } from './api'

export type Role = 'admin' | 'editor' | 'readonly'

interface AuthState {
  token: string | null
  username: string | null
  role: Role | null
  setSession: (token: string, username: string, role: Role) => void
  logout: () => void
}

interface FilesState {
  tree: TreeNode[]
  setTree: (tree: TreeNode[]) => void
}

const tokenKey = 'wikindie:token'
const userKey = 'wikindie:username'
const roleKey = 'wikindie:role'

export function canWrite(role: Role | null) {
  return role === 'admin' || role === 'editor'
}

export function canDelete(role: Role | null) {
  return role === 'admin'
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(tokenKey),
  username: localStorage.getItem(userKey),
  role: localStorage.getItem(roleKey) as Role | null,
  setSession: (token, username, role) => {
    localStorage.setItem(tokenKey, token)
    localStorage.setItem(userKey, username)
    localStorage.setItem(roleKey, role)
    set({ token, username, role })
  },
  logout: () => {
    localStorage.removeItem(tokenKey)
    localStorage.removeItem(userKey)
    localStorage.removeItem(roleKey)
    set({ token: null, username: null, role: null })
  },
}))

export const useFilesStore = create<FilesState>((set) => ({
  tree: [],
  setTree: (tree) => set({ tree }),
}))
