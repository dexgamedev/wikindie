import cors from 'cors'
import express from 'express'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { errorHandler } from './lib/errors.js'
import { ensureSpace } from './lib/files.js'
import { verifySession } from './lib/jwt.js'
import { startWatcher } from './lib/watcher.js'
import { requireAuth } from './middleware/auth.js'
import { authRouter } from './routes/auth.js'
import { filesRouter } from './routes/files.js'

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })
const port = Number(process.env.PORT ?? 3000)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../public')

await ensureSpace()

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api', requireAuth, filesRouter)
app.use(express.static(publicDir))
app.get('*splat', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')))
app.use(errorHandler)

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  if (url.pathname !== '/ws') return socket.destroy()

  try {
    verifySession(url.searchParams.get('token') ?? '')
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  } catch {
    socket.destroy()
  }
})

startWatcher(wss)

server.listen(port, () => {
  console.log(`Wikindie listening on http://localhost:${port}`)
})
