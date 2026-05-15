import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/errors.js'
import { signSession } from '../lib/jwt.js'
import { findUserByUsername, verifyPassword } from '../lib/users.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

const loginWindowMs = Math.max(Number(process.env.WIKINDIE_LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000), 1000)
const loginMaxAttempts = Math.max(Number(process.env.WIKINDIE_LOGIN_RATE_LIMIT_MAX ?? 10), 1)
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
let loginPruneCounter = 0

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
