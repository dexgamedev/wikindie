import argon2 from 'argon2'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { downgradeApiKeysForUser, revokeApiKeysForUser } from './apikeys.js'
import { AppError, notFound } from './errors.js'
import { safePath } from './files.js'
import { isRole, type Role } from './jwt.js'

export interface StoredUser {
  id: string
  username: string
  passwordHash: string
  role: Role
  createdAt: string
  updatedAt: string
}

export type PublicUser = Omit<StoredUser, 'passwordHash'>

interface UsersFile {
  version: 1
  users: StoredUser[]
}

let usersStore: UsersFile | null = null
let usersWriteLock: Promise<unknown> = Promise.resolve()

function usersPath() {
  return safePath('.wikindie/users.json')
}

function publicUser(user: StoredUser): PublicUser {
  const { passwordHash: _passwordHash, ...safeUser } = user
  return safeUser
}

function ensureUsersFile(value: unknown): UsersFile {
  if (!value || typeof value !== 'object') throw new Error('Invalid users.json')
  const users = (value as { users?: unknown }).users
  if (!Array.isArray(users)) throw new Error('Invalid users.json')
  for (const user of users) {
    if (!user || typeof user !== 'object') throw new Error('Invalid users.json')
    const candidate = user as Record<string, unknown>
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.username !== 'string' ||
      typeof candidate.passwordHash !== 'string' ||
      !isRole(candidate.role) ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string'
    ) {
      throw new Error('Invalid users.json')
    }
  }

  return { version: 1, users: users as StoredUser[] }
}

async function loadUsersFile() {
  const raw = await fs.readFile(usersPath(), 'utf8')
  return ensureUsersFile(JSON.parse(raw))
}

async function loadUsersStore() {
  if (usersStore) return usersStore
  usersStore = await loadUsersFile()
  return usersStore
}

async function saveUsersStore(store: UsersFile) {
  const fullPath = usersPath()
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, JSON.stringify(store, null, 2) + '\n', 'utf8')
  usersStore = store
}

async function withUsersWriteLock<T>(fn: () => Promise<T>) {
  const run = usersWriteLock.catch(() => undefined).then(fn)
  usersWriteLock = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function configuredAdminCredentials() {
  const configured = process.env.WIKINDIE_USER
  if (!configured) return null

  const separator = configured.indexOf(':')
  if (separator <= 0) throw new Error('WIKINDIE_USER must use username:password format')
  return [configured.slice(0, separator), configured.slice(separator + 1)] as const
}

async function createInitialAdmin(username: string, password: string) {
  const now = new Date().toISOString()
  const user: StoredUser = {
    id: randomUUID(),
    username,
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    role: 'admin',
    createdAt: now,
    updatedAt: now,
  }
  await saveUsersStore({ version: 1, users: [user] })
}

export async function initUserStore() {
  try {
    usersStore = await loadUsersFile()
    return
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const configured = configuredAdminCredentials()
  if (configured) {
    await createInitialAdmin(configured[0], configured[1])
    return
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('WIKINDIE_USER is required in production until users.json exists')
  }

  await createInitialAdmin('dev', 'dev')
}

export async function findUserByUsername(username: string) {
  const normalized = username.trim().toLowerCase()
  const store = await loadUsersStore()
  return store.users.find((user) => user.username.toLowerCase() === normalized) ?? null
}

export async function findUserById(id: string) {
  const store = await loadUsersStore()
  return store.users.find((user) => user.id === id) ?? null
}

export async function listUsers() {
  const store = await loadUsersStore()
  return store.users.map(publicUser)
}

export async function createUser(username: string, password: string, role: Role) {
  return withUsersWriteLock(async () => {
    const cleanUsername = username.trim()
    if (!cleanUsername) throw new AppError(400, 'Username is required')
    if (!password) throw new AppError(400, 'Password is required')

    const store = await loadUsersStore()
    if (store.users.some((user) => user.username.toLowerCase() === cleanUsername.toLowerCase())) {
      throw new AppError(409, 'Username already exists')
    }

    const now = new Date().toISOString()
    const user: StoredUser = {
      id: randomUUID(),
      username: cleanUsername,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role,
      createdAt: now,
      updatedAt: now,
    }
    await saveUsersStore({ ...store, users: [...store.users, user] })
    return publicUser(user)
  })
}

export async function updateUserRole(id: string, role: Role) {
  return withUsersWriteLock(async () => {
    const store = await loadUsersStore()
    const user = store.users.find((item) => item.id === id)
    if (!user) throw notFound('User not found')
    if (user.role === 'admin' && role !== 'admin' && store.users.filter((item) => item.role === 'admin').length <= 1) {
      throw new AppError(400, 'Cannot demote the last admin user')
    }

    const updated = { ...user, role, updatedAt: new Date().toISOString() }
    await saveUsersStore({ ...store, users: store.users.map((item) => (item.id === id ? updated : item)) })
    await downgradeApiKeysForUser(id, role)
    return publicUser(updated)
  })
}

export async function deleteUser(id: string) {
  return withUsersWriteLock(async () => {
    const store = await loadUsersStore()
    const user = store.users.find((item) => item.id === id)
    if (!user) throw notFound('User not found')
    if (user.role === 'admin' && store.users.filter((item) => item.role === 'admin').length <= 1) {
      throw new AppError(400, 'Cannot delete the last admin user')
    }

    await saveUsersStore({ ...store, users: store.users.filter((item) => item.id !== id) })
    await revokeApiKeysForUser(id)
  })
}

export async function verifyPassword(user: StoredUser, password: string) {
  return argon2.verify(user.passwordHash, password)
}
