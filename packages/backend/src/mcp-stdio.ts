#!/usr/bin/env node
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'

function mcpUrl() {
  const configured = process.env.WIKINDIE_URL?.trim() || 'http://localhost:3000'
  return new URL(configured.endsWith('/mcp') ? configured : `${configured.replace(/\/+$/, '')}/mcp`)
}

function errorResponse(message: JSONRPCMessage, error: unknown): JSONRPCMessage | null {
  if (!('id' in message) || message.id === undefined) return null
  return {
    jsonrpc: '2.0',
    id: message.id,
    error: {
      code: -32603,
      message: error instanceof Error ? error.message : 'Wikindie MCP bridge request failed',
    },
  }
}

function isInitializedNotification(message: JSONRPCMessage) {
  return 'method' in message && message.method === 'notifications/initialized' && !('id' in message)
}

async function main() {
  const apiKey = process.env.WIKINDIE_API_KEY?.trim()
  if (!apiKey) {
    console.error('WIKINDIE_API_KEY is required for the Wikindie MCP stdio bridge.')
    process.exit(1)
  }

  const stdio = new StdioServerTransport()
  const http = new StreamableHTTPClientTransport(mcpUrl(), {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  })

  stdio.onerror = (error) => console.error('Wikindie MCP stdio error:', error)
  http.onerror = (error) => console.error('Wikindie MCP HTTP error:', error)

  stdio.onmessage = (message) => {
    if (isInitializedNotification(message)) return
    void http.send(message).catch(async (error) => {
      const response = errorResponse(message, error)
      if (response) await stdio.send(response).catch(() => undefined)
    })
  }
  http.onmessage = (message) => {
    void stdio.send(message).catch((error) => console.error('Wikindie MCP bridge send error:', error))
  }
  http.onclose = () => {
    void stdio.close().catch(() => undefined)
  }

  await http.start()
  await stdio.start()
}

process.on('SIGINT', () => process.exit(0))

main().catch((error) => {
  console.error('Wikindie MCP stdio bridge failed:', error)
  process.exit(1)
})
