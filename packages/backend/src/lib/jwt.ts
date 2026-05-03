import jwt from 'jsonwebtoken'

export const roles = ['admin', 'editor', 'readonly'] as const
export type Role = (typeof roles)[number]

const roleRank = {
  readonly: 0,
  editor: 1,
  admin: 2,
} satisfies Record<Role, number>

function secret() {
  const configured = process.env.JWT_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production')
  return 'dev-secret-change-me'
}

export interface SessionUser {
  id: string
  username: string
  role: Role
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (roles as readonly string[]).includes(value)
}

export function roleExceeds(role: Role, maxRole: Role) {
  return roleRank[role] > roleRank[maxRole]
}

export function capRole(role: Role, maxRole: Role) {
  return roleExceeds(role, maxRole) ? maxRole : role
}

export function signSession(user: SessionUser) {
  return jwt.sign(user, secret(), { expiresIn: '7d' })
}

export function verifySession(token: string): SessionUser {
  const payload = jwt.verify(token, secret())
  if (!payload || typeof payload !== 'object') throw new Error('Invalid session payload')

  const { id, username, role } = payload as Record<string, unknown>
  if (typeof id !== 'string' || typeof username !== 'string' || !isRole(role)) {
    throw new Error('Invalid session payload')
  }

  return { id, username, role }
}
