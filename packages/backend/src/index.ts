import cors from 'cors'
import express from 'express'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { initApiKeyStore } from './lib/apikeys.js'
import { isAllowedCorsOrigin, isAllowedHostHeader, publicConfig, requireAllowedHost } from './lib/config.js'
import { errorHandler } from './lib/errors.js'
import { ensureSpace } from './lib/files.js'
import { initUserStore } from './lib/users.js'
import { startWatcher } from './lib/watcher.js'
import { authenticateToken, requireAuth, requireAuthOrPublicRead } from './middleware/auth.js'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { filesRouter } from './routes/files.js'
import { recentsRouter } from './routes/recents.js'

import { statsRouter } from './routes/stats.js'

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })
const port = Number(process.env.PORT ?? 3000)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../public')

app.set('trust proxy', 1)

await ensureSpace()
await initUserStore()
await initApiKeyStore()

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use(requireAllowedHost)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  next()
})
app.use(cors({ origin: (origin, callback) => callback(null, isAllowedCorsOrigin(origin)) }))
app.use(express.json({ limit: '2mb' }))
app.get('/api/config', (_req, res) => res.json(publicConfig()))
app.use('/api/auth', authRouter)
app.use('/api/admin', requireAuth, adminRouter)
app.use('/api/recents', requireAuthOrPublicRead, recentsRouter)
app.use('/api/stats', requireAuthOrPublicRead, statsRouter)

app.use('/api', requireAuthOrPublicRead, filesRouter)
app.use(express.static(publicDir))
app.get('*splat', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')))
app.use(errorHandler)

server.on('upgrade', (req, socket, head) => {
  if (!isAllowedHostHeader(req.headers.host)) return socket.destroy()

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  if (url.pathname !== '/ws') return socket.destroy()

  void authenticateToken(url.searchParams.get('token') ?? '')
    .then(() => wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req)))
    .catch(() => socket.destroy())
})

startWatcher(wss)

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing process or start Wikindie with a different PORT.`)
    process.exit(1)
  }
  throw error
})

server.listen(port, () => {
  console.log(`Wikindie listening on http://localhost:${port}`)
})
