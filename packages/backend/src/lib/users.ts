import argon2 from 'argon2'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { downgradeApiKeysForUser, revokeApiKeysForUser } from './apikeys.js'
import { oidcEnabled } from './config.js'
import { AppError, notFound } from './errors.js'
import { safePath } from './files.js'
import { isRole, type Role } from './jwt.js'

export type AuthProvider = 'local' | 'oidc'

export interface StoredUser {
  id: string
  username: string
  /** Absent for users provisioned purely through OIDC. */
  passwordHash?: string
  role: Role
  /** Identity provider that owns this account. Defaults to 'local' when absent. */
  provider?: AuthProvider
  /** Stable OIDC subject (`sub`) once the account has been linked to SSO. */
  subject?: string
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
      (candidate.passwordHash !== undefined && typeof candidate.passwordHash !== 'string') ||
      (candidate.provider !== undefined && candidate.provider !== 'local' && candidate.provider !== 'oidc') ||
      (candidate.subject !== undefined && typeof candidate.subject !== 'string') ||
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
    // With OIDC on, accounts are provisioned just-in-time on first SSO login, so
    // an empty store is a valid starting point and WIKINDIE_USER is optional.
    if (oidcEnabled) {
      await saveUsersStore({ version: 1, users: [] })
      return
    }
    throw new Error('In production you must set WIKINDIE_USER, enable OIDC, or have an existing users.json')
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

export async function findUserBySubject(subject: string) {
  const store = await loadUsersStore()
  return store.users.find((user) => user.subject === subject) ?? null
}

/**
 * Resolve (and lazily provision) the local account backing an OIDC identity.
 * Matching order: stable subject → existing username (adopted/linked). New
 * identities are created without a password so they can only sign in via SSO.
 */
export async function upsertOidcUser(profile: {
  subject: string
  username: string
  role: Role
  syncRole: boolean
}) {
  return withUsersWriteLock(async () => {
    const store = await loadUsersStore()
    const now = new Date().toISOString()

    const existing = store.users.find((user) => user.subject === profile.subject)
    if (existing) {
      const nextRole = profile.syncRole ? profile.role : existing.role
      const updated: StoredUser = {
        ...existing,
        username: existing.username, // keep the established handle stable
        role: nextRole,
        provider: 'oidc',
        updatedAt: now,
      }
      const roleChanged = updated.role !== existing.role
      await saveUsersStore({ ...store, users: store.users.map((item) => (item.id === existing.id ? updated : item)) })
      if (roleChanged) await downgradeApiKeysForUser(existing.id, updated.role)
      return publicUser(updated)
    }

    const cleanUsername = profile.username.trim()
    const byUsername = cleanUsername
      ? store.users.find((user) => user.username.toLowerCase() === cleanUsername.toLowerCase())
      : undefined
    if (byUsername) {
      if (byUsername.subject && byUsername.subject !== profile.subject) {
        throw new AppError(409, 'Username is already linked to a different SSO identity')
      }
      // Adopt a pre-existing (typically local) account. Keep its current role so
      // we never silently downgrade an admin; keep the password so local login
      // still works alongside SSO.
      const updated: StoredUser = {
        ...byUsername,
        subject: profile.subject,
        provider: byUsername.passwordHash ? byUsername.provider ?? 'local' : 'oidc',
        updatedAt: now,
      }
      await saveUsersStore({ ...store, users: store.users.map((item) => (item.id === byUsername.id ? updated : item)) })
      return publicUser(updated)
    }

    const user: StoredUser = {
      id: randomUUID(),
      username: cleanUsername || profile.subject,
      role: profile.role,
      provider: 'oidc',
      subject: profile.subject,
      createdAt: now,
      updatedAt: now,
    }
    await saveUsersStore({ ...store, users: [...store.users, user] })
    return publicUser(user)
  })
}

export async function verifyPassword(user: StoredUser, password: string) {
  if (!user.passwordHash) return false
  return argon2.verify(user.passwordHash, password)
}

export async function changeUserPassword(id: string, newPassword: string) {
  return withUsersWriteLock(async () => {
    const store = await loadUsersStore()
    const user = store.users.find((item) => item.id === id)
    if (!user) throw notFound('User not found')

    const updated = {
      ...user,
      passwordHash: await argon2.hash(newPassword, { type: argon2.argon2id }),
      updatedAt: new Date().toISOString(),
    }
    await saveUsersStore({ ...store, users: store.users.map((item) => (item.id === id ? updated : item)) })
    return publicUser(updated)
  })
}
