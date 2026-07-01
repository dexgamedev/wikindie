import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { deleteApiKey, generateApiKey, listApiKeys, revokeApiKey } from '../lib/apikeys.js'
import { AppError } from '../lib/errors.js'
import { capRole, isRole, signSession } from '../lib/jwt.js'
import { changeUserPassword, findUserById, findUserByUsername, verifyPassword } from '../lib/users.js'
import { requireAuth, requireSessionAuth } from '../middleware/auth.js'

export const authRouter = Router()

const loginWindowMs = Math.max(Number(process.env.WIKINDIE_LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000), 1000)
const loginMaxAttempts = Math.max(Number(process.env.WIKINDIE_LOGIN_RATE_LIMIT_MAX ?? 10), 1)
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
let loginPruneCounter = 0

const passwordWindowMs = Math.max(Number(process.env.WIKINDIE_PASSWORD_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000), 1000)
const passwordMaxAttempts = Math.max(Number(process.env.WIKINDIE_PASSWORD_RATE_LIMIT_MAX ?? 5), 1)
const passwordAttempts = new Map<string, { count: number; resetAt: number }>()
let passwordPruneCounter = 0

function pruneExpiredLoginAttempts(now: number) {
  loginPruneCounter += 1
  if (loginPruneCounter % 25 !== 0) return

  for (const [key, entry] of loginAttempts) {
    if (entry.resetAt <= now) loginAttempts.delete(key)
  }
}

function loginRateLimit(req: Request, _res: Response, next: NextFunction) {
  const key = req.ip || req.socket.remoteAddress || 'unknown'
  const now = Date.now()
  pruneExpiredLoginAttempts(now)
  const current = loginAttempts.get(key)
  const entry = current && current.resetAt > now ? current : { count: 0, resetAt: now + loginWindowMs }

  entry.count += 1
  loginAttempts.set(key, entry)
  if (entry.count > loginMaxAttempts) {
    throw new AppError(429, 'Too many login attempts. Try again later.')
  }

  next()
}

function clearLoginRateLimit(req: Request) {
  loginAttempts.delete(req.ip || req.socket.remoteAddress || 'unknown')
}

function pruneExpiredPasswordAttempts(now: number) {
  passwordPruneCounter += 1
  if (passwordPruneCounter % 25 !== 0) return

  for (const [key, entry] of passwordAttempts) {
    if (entry.resetAt <= now) passwordAttempts.delete(key)
  }
}

function assertPasswordChangeRateLimit(userId: string) {
  const now = Date.now()
  pruneExpiredPasswordAttempts(now)
  const entry = passwordAttempts.get(userId)
  if (entry && entry.resetAt > now && entry.count >= passwordMaxAttempts) {
    throw new AppError(429, 'Too many password change attempts. Try again later.')
  }
}

function recordPasswordChangeFailure(userId: string) {
  const now = Date.now()
  pruneExpiredPasswordAttempts(now)
  const current = passwordAttempts.get(userId)
  const entry = current && current.resetAt > now ? current : { count: 0, resetAt: now + passwordWindowMs }
  entry.count += 1
  passwordAttempts.set(userId, entry)
}

function clearPasswordChangeRateLimit(userId: string) {
  passwordAttempts.delete(userId)
}

authRouter.post('/login', loginRateLimit, async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string }
  if (!username || !password) throw new AppError(401, 'Invalid credentials')

  const user = await findUserByUsername(username)
  if (!user || !(await verifyPassword(user, password))) throw new AppError(401, 'Invalid credentials')

  const session = { id: user.id, username: user.username, role: user.role }
  clearLoginRateLimit(req)
  res.json({ token: signSession(session), user: session })
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

const minPasswordLength = 8

authRouter.post('/password', requireSessionAuth, async (req, res) => {
  const sessionUser = assertUser(req)
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string }

  if (typeof currentPassword !== 'string' || !currentPassword) {
    throw new AppError(400, 'Current password is required')
  }
  if (typeof newPassword !== 'string' || newPassword.length < minPasswordLength) {
    throw new AppError(400, `New password must be at least ${minPasswordLength} characters`)
  }

  const user = (await findUserById(sessionUser.id)) ?? (await findUserByUsername(sessionUser.username))
  if (!user) throw new AppError(401, 'Authentication required')

  assertPasswordChangeRateLimit(user.id)

  if (!(await verifyPassword(user, currentPassword))) {
    recordPasswordChangeFailure(user.id)
    throw new AppError(400, 'Current password is incorrect')
  }

  await changeUserPassword(user.id, newPassword)
  clearPasswordChangeRateLimit(user.id)
  res.json({ ok: true })
})

function assertUser(req: Request) {
  if (!req.user) throw new AppError(401, 'Authentication required')
  return req.user
}

async function resolveUserApiKey(req: Request) {
  const user = assertUser(req)
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const key = (await listApiKeys(user.id)).find((item) => item.id === id)
  if (!key) throw new AppError(404, 'API key not found')
  return { user, id, key }
}

authRouter.get('/apikeys', requireSessionAuth, async (req, res) => {
  res.json({ keys: await listApiKeys(assertUser(req).id) })
})

authRouter.post('/apikeys', requireSessionAuth, async (req, res) => {
  const { label, role } = req.body as { label?: string; role?: unknown }
  const user = assertUser(req)
  if (!isRole(role)) throw new AppError(400, 'Invalid role')
  const generated = await generateApiKey(user.id, capRole(role, user.role), label ?? '')
  res.status(201).json(generated)
})

authRouter.delete('/apikeys/:id', requireSessionAuth, async (req, res) => {
  const { id } = await resolveUserApiKey(req)
  await revokeApiKey(id)
  res.json({ ok: true })
})

authRouter.delete('/apikeys/:id/permanent', requireSessionAuth, async (req, res) => {
  const { id } = await resolveUserApiKey(req)
  await deleteApiKey(id)
  res.json({ ok: true })
})
