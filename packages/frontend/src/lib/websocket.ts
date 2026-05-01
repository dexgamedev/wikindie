import { useAuthStore } from './store'

export type WikiEvent = { type: 'tree:changed' } | { type: 'file:changed'; path: string }

export function connectWebSocket(onMessage: (event: WikiEvent) => void) {
  let socket: WebSocket | undefined
  let closed = false
  let attempts = 0

  const connect = () => {
    const token = useAuthStore.getState().token
    if (!token || closed) return
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    socket = new WebSocket(`${protocol}://${location.host}/ws?token=${encodeURIComponent(token)}`)
    socket.onopen = () => {
      attempts = 0
    }
    socket.onmessage = (message) => onMessage(JSON.parse(message.data) as WikiEvent)
    socket.onclose = () => {
      if (closed) return
      attempts += 1
      window.setTimeout(connect, Math.min(8000, 500 * 2 ** attempts))
    }
  }

  connect()
  return () => {
    closed = true
    socket?.close()
  }
}
