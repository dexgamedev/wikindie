import chokidar from 'chokidar'
import path from 'node:path'
import type { WebSocketServer } from 'ws'
import { SPACE_DIR } from './files.js'

function broadcast(wss: WebSocketServer, payload: unknown) {
  const message = JSON.stringify(payload)
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(message)
  }
}

export function startWatcher(wss: WebSocketServer) {
  const watcher = chokidar.watch(SPACE_DIR, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  })

  const treeChanged = () => broadcast(wss, { type: 'tree:changed' })
  const fileChanged = (filePath: string) => {
    const rel = path.relative(SPACE_DIR, filePath).replaceAll(path.sep, '/')
    if (rel.endsWith('.md')) broadcast(wss, { type: 'file:changed', path: rel })
    treeChanged()
  }

  watcher.on('add', fileChanged).on('change', fileChanged).on('unlink', fileChanged).on('addDir', treeChanged).on('unlinkDir', treeChanged)
  return watcher
}
