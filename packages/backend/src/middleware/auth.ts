import type { NextFunction, Request, Response } from 'express'
import { verifyApiKey } from '../lib/apikeys.js'
import { AppError } from '../lib/errors.js'
import { capRole, verifySession, type SessionUser } from '../lib/jwt.js'
import { findUserById } from '../lib/users.js'

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

export async function authenticateToken(token: string): Promise<SessionUser> {
  if (token.startsWith('wk_')) {
    const apiKey = await verifyApiKey(token)
    if (!apiKey) throw new Error('Invalid API key')
    const user = await findUserById(apiKey.userId)
    if (!user) throw new Error('Invalid API key user')
    return { id: user.id, username: user.username, role: capRole(apiKey.role, user.role) }
  }

  if (token.split('.').length === 3) {
    const session = verifySession(token)
    const user = await findUserById(session.id)
    if (!user) throw new Error('Invalid session user')
    return { id: user.id, username: user.username, role: user.role }
  }

  throw new Error('Unsupported authorization token')
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) throw new AppError(401, 'Missing authorization token')

  try {
    req.user = await authenticateToken(token)
    next()
  } catch {
    throw new AppError(401, 'Invalid authorization token')
  }
}
