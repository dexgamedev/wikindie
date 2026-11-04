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
import { dropPrivileges } from './lib/privileges.js'
import { initUserStore } from './lib/users.js'
import { startWatcher } from './lib/watcher.js'
import { authenticateToken, requireAuth, requireAuthOrPublicRead } from './middleware/auth.js'
import { adminRouter } from './routes/admin.js'
import { attachmentsRouter } from './routes/attachments.js'
import { authRouter } from './routes/auth.js'
import { filesRouter } from './routes/files.js'
import { mcpRouter } from './routes/mcp.js'
import { recentsRouter } from './routes/recents.js'

import { statsRouter } from './routes/stats.js'

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })
const port = Number(process.env.PORT ?? 3000)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../public')

app.set('trust proxy', 1)

await dropPrivileges()
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
app.use('/api/attachments', requireAuthOrPublicRead, attachmentsRouter)

app.use('/api', requireAuthOrPublicRead, filesRouter)
app.use('/mcp', requireAuth, mcpRouter)
app.use(express.static(publicDir))
app.get('*splat', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')))
app.use(errorHandler)

server.on('upgrade', (req, socket, head) => {
  // Reject with a real HTTP response instead of a bare socket destroy so proxies
  // report a clean status instead of "socket hang up", and say why in the log.
  const reject = (status: number, statusText: string, reason: string) => {
    socket.on('error', () => {})
    try {
      if (!socket.destroyed) socket.write(`HTTP/1.1 ${status} ${statusText}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
    } catch {
      // The peer may already be gone; nothing to write.
    }
    socket.destroy()
    console.warn(`WebSocket upgrade rejected (${status} ${statusText}): ${reason}`)
  }

  if (!isAllowedHostHeader(req.headers.host)) return reject(403, 'Forbidden', `host ${req.headers.host ?? 'unknown'} is not allowed`)

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  if (url.pathname !== '/ws') return reject(404, 'Not Found', `unexpected path ${url.pathname}`)

  const token = url.searchParams.get('token') ?? ''
  if (!token) return reject(401, 'Unauthorized', 'missing token')

  void authenticateToken(token)
    .then(() => wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req)))
    .catch((error) => reject(401, 'Unauthorized', error instanceof Error ? error.message : 'invalid token'))
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
