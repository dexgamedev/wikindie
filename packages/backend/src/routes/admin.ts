import { Router } from 'express'
import { generateApiKey, listApiKeys, revokeApiKey } from '../lib/apikeys.js'
import { AppError } from '../lib/errors.js'
import { capRole, isRole } from '../lib/jwt.js'
import { createUser, deleteUser, findUserById, listUsers, updateUserRole } from '../lib/users.js'
import { requireRole } from '../middleware/permissions.js'

export const adminRouter = Router()

adminRouter.use(requireRole('admin'))

adminRouter.get('/users', async (_req, res) => {
  res.json({ users: await listUsers() })
})

adminRouter.post('/users', async (req, res) => {
  const { username, password, role } = req.body as { username?: string; password?: string; role?: unknown }
  if (!isRole(role)) throw new AppError(400, 'Invalid role')
  const user = await createUser(username ?? '', password ?? '', role)
  res.status(201).json({ user })
})

adminRouter.delete('/users/:id', async (req, res) => {
  await deleteUser(req.params.id)
  res.json({ ok: true })
})

adminRouter.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body as { role?: unknown }
  if (!isRole(role)) throw new AppError(400, 'Invalid role')
  res.json({ user: await updateUserRole(req.params.id, role) })
})

adminRouter.get('/apikeys', async (_req, res) => {
  res.json({ keys: await listApiKeys() })
})

adminRouter.post('/apikeys', async (req, res) => {
  const { label, role, userId } = req.body as { label?: string; role?: unknown; userId?: string }
  if (!isRole(role)) throw new AppError(400, 'Invalid role')

  const ownerId = userId?.trim() || req.user?.id
  const owner = ownerId ? await findUserById(ownerId) : null
  if (!owner) throw new AppError(400, 'Invalid user')

  const generated = await generateApiKey(owner.id, capRole(role, owner.role), label ?? '')
  res.status(201).json(generated)
})

adminRouter.delete('/apikeys/:id', async (req, res) => {
  await revokeApiKey(req.params.id)
  res.json({ ok: true })
})
