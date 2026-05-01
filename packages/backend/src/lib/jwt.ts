import jwt from 'jsonwebtoken'

function secret() {
  const configured = process.env.JWT_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production')
  return 'dev-secret-change-me'
}

export interface SessionUser {
  username: string
}

export function signSession(user: SessionUser) {
  return jwt.sign(user, secret(), { expiresIn: '7d' })
}

export function verifySession(token: string): SessionUser {
  return jwt.verify(token, secret()) as SessionUser
}
