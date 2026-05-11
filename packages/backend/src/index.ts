import cors from 'cors'
import express from 'express'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { initApiKeyStore } from './lib/apikeys.js'
import { errorHandler } from './lib/errors.js'
import { ensureSpace } from './lib/files.js'
import { initUserStore } from './lib/users.js'
import { startWatcher } from './lib/watcher.js'
import { authenticateToken, requireAuth } from './middleware/auth.js'
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

await ensureSpace()
await initUserStore()
await initApiKeyStore()

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api/admin', requireAuth, adminRouter)
app.use('/api/recents', requireAuth, recentsRouter)
app.use('/api/stats', requireAuth, statsRouter)

app.use('/api', requireAuth, filesRouter)
app.use(express.static(publicDir))
app.get('*splat', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')))
app.use(errorHandler)

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  if (url.pathname !== '/ws') return socket.destroy()

  void authenticateToken(url.searchParams.get('token') ?? '')
    .then(() => wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req)))
    .catch(() => socket.destroy())
})

startWatcher(wss)

server.listen(port, () => {
  console.log(`Wikindie listening on http://localhost:${port}`)
})
