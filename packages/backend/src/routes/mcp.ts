import { Router } from 'express'
import type { Request, Response } from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isAllowedCorsOrigin } from '../lib/config.js'
import { createWikindieMcpServer } from '../mcp/server.js'

export const mcpRouter = Router()

mcpRouter.use((req, res, next) => {
  if (!isAllowedCorsOrigin(req.header('origin') ?? undefined)) {
    res.status(403).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Origin not allowed.' }, id: null })
    return
  }
  next()
})

function methodNotAllowed(_req: Request, res: Response) {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  })
}

mcpRouter.post('/', async (req, res) => {
  if (!req.user) {
    res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Authentication required.' }, id: null })
    return
  }

  const server = createWikindieMcpServer(req.user)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  const cleanup = () => {
    void transport.close().catch(() => undefined)
    void server.close().catch(() => undefined)
  }
  res.on('close', cleanup)
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (error) {
    cleanup()
    console.error('Error handling MCP request:', error)
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null })
    }
  }
})

mcpRouter.get('/', methodNotAllowed)
mcpRouter.delete('/', methodNotAllowed)
