import { Router } from 'express'
import { AppError } from '../lib/errors.js'
import { signSession } from '../lib/jwt.js'
import { findUserByUsername, verifyPassword } from '../lib/users.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string }
  if (!username || !password) throw new AppError(401, 'Invalid credentials')

  const user = await findUserByUsername(username)
  if (!user || !(await verifyPassword(user, password))) throw new AppError(401, 'Invalid credentials')

  const session = { id: user.id, username: user.username, role: user.role }
  res.json({ token: signSession(session), user: session })
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})
