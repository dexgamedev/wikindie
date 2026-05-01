import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/errors.js'
import { verifySession, type SessionUser } from '../lib/jwt.js'

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) throw new AppError(401, 'Missing authorization token')

  try {
    req.user = verifySession(token)
    next()
  } catch {
    throw new AppError(401, 'Invalid authorization token')
  }
}
