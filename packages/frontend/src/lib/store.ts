import { create } from 'zustand'
import type { TreeNode } from './api'

interface AuthState {
  token: string | null
  username: string | null
  setSession: (token: string, username: string) => void
  logout: () => void
}

interface FilesState {
  tree: TreeNode[]
  setTree: (tree: TreeNode[]) => void
}

const tokenKey = 'wikindie:token'
const userKey = 'wikindie:username'

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(tokenKey),
  username: localStorage.getItem(userKey),
  setSession: (token, username) => {
    localStorage.setItem(tokenKey, token)
    localStorage.setItem(userKey, username)
    set({ token, username })
  },
  logout: () => {
    localStorage.removeItem(tokenKey)
    localStorage.removeItem(userKey)
    set({ token: null, username: null })
  },
}))

export const useFilesStore = create<FilesState>((set) => ({
  tree: [],
  setTree: (tree) => set({ tree }),
}))
