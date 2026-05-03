import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { AppError, notFound } from './errors.js'
import { safePath } from './files.js'
import { roleExceeds, type Role } from './jwt.js'

export interface ApiKeyRecord {
  id: string
  prefix: string
  hashedKey: string
  userId: string
  role: Role
  label: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export type PublicApiKeyRecord = Omit<ApiKeyRecord, 'hashedKey'>

interface ApiKeysFile {
  version: 1
  keys: ApiKeyRecord[]
}

let apiKeyStore: ApiKeysFile | null = null
let apiKeyWriteLock: Promise<unknown> = Promise.resolve()

function apiKeysPath() {
  return safePath('.wikindie/apikeys.json')
}

function publicApiKey(record: ApiKeyRecord): PublicApiKeyRecord {
  const { hashedKey: _hashedKey, ...safeRecord } = record
  return safeRecord
}

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

function ensureApiKeysFile(value: unknown): ApiKeysFile {
  if (!value || typeof value !== 'object') throw new Error('Invalid apikeys.json')
  const keys = (value as { keys?: unknown }).keys
  if (!Array.isArray(keys)) throw new Error('Invalid apikeys.json')
  return { version: 1, keys: keys as ApiKeyRecord[] }
}

async function loadApiKeysFile() {
  const raw = await fs.readFile(apiKeysPath(), 'utf8')
  return ensureApiKeysFile(JSON.parse(raw))
}

async function loadApiKeyStore() {
  if (apiKeyStore) return apiKeyStore
  try {
    apiKeyStore = await loadApiKeysFile()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    apiKeyStore = { version: 1, keys: [] }
  }
  return apiKeyStore
}

async function saveApiKeyStore(store: ApiKeysFile) {
  const fullPath = apiKeysPath()
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, JSON.stringify(store, null, 2) + '\n', 'utf8')
  apiKeyStore = store
}

async function withApiKeyWriteLock<T>(fn: () => Promise<T>) {
  const run = apiKeyWriteLock.catch(() => undefined).then(fn)
  apiKeyWriteLock = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function initApiKeyStore() {
  try {
    apiKeyStore = await loadApiKeysFile()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await saveApiKeyStore({ version: 1, keys: [] })
  }
}

export async function generateApiKey(userId: string, role: Role, label: string) {
  return withApiKeyWriteLock(async () => {
    const cleanLabel = label.trim()
    if (!cleanLabel) throw new AppError(400, 'API key label is required')

    const key = `wk_${randomBytes(32).toString('base64url')}`
    const record: ApiKeyRecord = {
      id: randomUUID(),
      prefix: key.slice(0, 11),
      hashedKey: hashKey(key),
      userId,
      role,
      label: cleanLabel,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    }

    const store = await loadApiKeyStore()
    await saveApiKeyStore({ ...store, keys: [...store.keys, record] })
    return { key, record: publicApiKey(record) }
  })
}

export async function verifyApiKey(rawKey: string) {
  if (!rawKey.startsWith('wk_')) return null
  return withApiKeyWriteLock(async () => {
    const store = await loadApiKeyStore()
    const hashedKey = hashKey(rawKey)
    const index = store.keys.findIndex((record) => record.hashedKey === hashedKey && !record.revokedAt)
    if (index < 0) return null

    const record = store.keys[index]
    const updated = { ...record, lastUsedAt: new Date().toISOString() }
    const keys = [...store.keys]
    keys[index] = updated
    await saveApiKeyStore({ ...store, keys })
    return { userId: record.userId, role: record.role }
  })
}

export async function listApiKeys(userId?: string) {
  const store = await loadApiKeyStore()
  return store.keys.filter((record) => !userId || record.userId === userId).map(publicApiKey)
}

export async function revokeApiKey(id: string) {
  return withApiKeyWriteLock(async () => {
    const store = await loadApiKeyStore()
    const record = store.keys.find((item) => item.id === id)
    if (!record) throw notFound('API key not found')
    if (record.revokedAt) return publicApiKey(record)

    const updated = { ...record, revokedAt: new Date().toISOString() }
    await saveApiKeyStore({ ...store, keys: store.keys.map((item) => (item.id === id ? updated : item)) })
    return publicApiKey(updated)
  })
}

export async function revokeApiKeysForUser(userId: string) {
  return withApiKeyWriteLock(async () => {
    const store = await loadApiKeyStore()
    const revokedAt = new Date().toISOString()
    let changed = false
    const keys = store.keys.map((record) => {
      if (record.userId !== userId || record.revokedAt) return record
      changed = true
      return { ...record, revokedAt }
    })

    if (changed) await saveApiKeyStore({ ...store, keys })
  })
}

export async function downgradeApiKeysForUser(userId: string, maxRole: Role) {
  return withApiKeyWriteLock(async () => {
    const store = await loadApiKeyStore()
    let changed = false
    const keys = store.keys.map((record) => {
      if (record.userId !== userId || record.revokedAt || !roleExceeds(record.role, maxRole)) return record
      changed = true
      return { ...record, role: maxRole }
    })

    if (changed) await saveApiKeyStore({ ...store, keys })
  })
}
