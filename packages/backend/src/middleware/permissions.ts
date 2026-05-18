import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/errors.js'
import { roleExceeds, type Role, type SessionUser } from '../lib/jwt.js'

export type PermissionAction = 'read' | 'write' | 'delete'

export function assertPermission(user: SessionUser, action: PermissionAction) {
  const requiredRole = action === 'delete' ? 'admin' : action === 'write' ? 'editor' : 'readonly'
  if (roleExceeds(requiredRole, user.role)) throw new AppError(403, 'Insufficient permissions')
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError(401, 'Authentication required')
    if (!roles.includes(req.user.role)) throw new AppError(403, 'Insufficient permissions')
    next()
  }
}

export function requirePermission(action: PermissionAction) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError(401, 'Authentication required')
    assertPermission(req.user, action)
    next()
  }
}
