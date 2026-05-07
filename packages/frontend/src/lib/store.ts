import { create } from 'zustand'
import type { TreeNode } from './api'
import { defaultTaskFilters, type TaskFilterValues, type TaskPriorityFilter } from './taskFilters'

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

interface TaskFiltersState extends TaskFilterValues {
  pagePath: string
  setTaskFilterPath: (pagePath: string) => void
  setPriorityFilter: (priorityFilter: TaskPriorityFilter) => void
  setAssigneeFilter: (assigneeFilter: string) => void
  setSearchPattern: (searchPattern: string) => void
  clearTaskFilters: () => void
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

export const useTaskFiltersStore = create<TaskFiltersState>((set) => ({
  pagePath: '',
  ...defaultTaskFilters,
  setTaskFilterPath: (pagePath) => set((state) => (state.pagePath === pagePath ? state : { pagePath, ...defaultTaskFilters })),
  setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
  setAssigneeFilter: (assigneeFilter) => set({ assigneeFilter }),
  setSearchPattern: (searchPattern) => set({ searchPattern }),
  clearTaskFilters: () => set(defaultTaskFilters),
}))
