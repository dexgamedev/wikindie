import { Router } from 'express'
import { AppError } from '../lib/errors.js'
import { signSession } from '../lib/jwt.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

function configuredCredentials() {
  const configured = process.env.WIKINDIE_USER
  if (!configured) {
    if (process.env.NODE_ENV === 'production') throw new AppError(500, 'WIKINDIE_USER is required in production')
    return ['dev', 'dev'] as const
  }

  const separator = configured.indexOf(':')
  if (separator <= 0) throw new AppError(500, 'WIKINDIE_USER must use username:password format')
  return [configured.slice(0, separator), configured.slice(separator + 1)] as const
}

authRouter.post('/login', (req, res) => {
  const [expectedUser, expectedPass] = configuredCredentials()
  const { username, password } = req.body as { username?: string; password?: string }
  if (username !== expectedUser || password !== expectedPass) throw new AppError(401, 'Invalid credentials')
  res.json({ token: signSession({ username }), user: { username } })
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})
