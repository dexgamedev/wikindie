import { Braces, ChevronRight, Copy, KeyRound, MousePointerClick, PlugZap, RefreshCw, SquareTerminal, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api, type ApiKeyRecord } from '../../lib/api'
import { roleBadgeClass } from '../../lib/badges'
import { formatDate } from '../../lib/format'
import { useAuthStore, type Role } from '../../lib/store'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface ClientConfig {
  id: string
  label: string
  icon: LucideIcon
  filePath?: string
  snippet: (mcpUrl: string, key: string) => string
}

const clientConfigs: ClientConfig[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    icon: SquareTerminal,
    snippet: (mcpUrl, key) => `claude mcp add wikindie -t http ${mcpUrl} --header "Authorization: Bearer ${key}"`,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    icon: MousePointerClick,
    filePath: '.cursor/mcp.json',
    snippet: (mcpUrl, key) =>
      JSON.stringify({ mcpServers: { wikindie: { url: mcpUrl, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
  },
  {
    id: 'opencode',
    label: 'opencode',
    icon: Braces,
    filePath: '~/.config/opencode/config.json',
    snippet: (mcpUrl, key) =>
      JSON.stringify({ mcp: { wikindie: { type: 'remote', url: mcpUrl, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
  },
]

const roles: Role[] = ['readonly', 'editor', 'admin']

function defaultMcpUrl() {
  if (window.location.hostname === 'localhost' && window.location.port === '5173') return 'http://localhost:3000/mcp'
  return `${window.location.origin}/mcp`
}

function Snippet({ title, value, onCopy }: { title: string; value: string; onCopy: (value: string) => void }) {
  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <Button onClick={() => onCopy(value)}>
          <Copy size={14} /> Copy
        </Button>
      </div>
      <pre className="workspace-scroll max-h-[360px] overflow-auto p-4 text-xs leading-relaxed text-text"><code>{value}</code></pre>
    </div>
  )
}

export function McpConnectionPanel({ showHeader = true }: { showHeader?: boolean }) {
  const userRole = useAuthStore((state) => state.role)
  const [keys, setKeys] = useState<ApiKeyRecord[]>([])
  const [label, setLabel] = useState('Local MCP agent')
  const [role, setRole] = useState<Role>('editor')
  const [createdKey, setCreatedKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState('')
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [showActiveKeys, setShowActiveKeys] = useState(true)
  const [showRevokedKeys, setShowRevokedKeys] = useState(false)
  const mcpUrl = defaultMcpUrl()

  const availableRoles = useMemo(() => {
    if (userRole === 'admin') return roles
    if (userRole === 'editor') return roles.filter((item) => item !== 'admin')
    return roles.filter((item) => item === 'readonly')
  }, [userRole])

  useEffect(() => {
    if (!availableRoles.includes(role)) setRole(availableRoles[0] ?? 'readonly')
  }, [availableRoles, role])

  const refresh = async () => {
    setError('')
    setLoading(true)
    try {
      setKeys((await api.apiKeys()).keys)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const generate = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setCopied('')
    setCreatedKey('')
    try {
      const result = await api.generateApiKey(label, role)
      setCreatedKey(result.key)
      setKeys((current) => [...current, result.record])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate API key')
    }
  }

  const activeKeys = useMemo(() => keys.filter((key) => !key.revokedAt), [keys])
  const revokedKeys = useMemo(() => keys.filter((key) => key.revokedAt), [keys])

  const revoke = async (key: ApiKeyRecord) => {
    if (!window.confirm(`Revoke API key ${key.prefix}?`)) return
    setError('')
    try {
      await api.revokeApiKey(key.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key')
    }
  }

  const deleteKey = async (key: ApiKeyRecord) => {
    if (!window.confirm(`Permanently delete API key ${key.prefix}? This cannot be undone.`)) return
    setError('')
    try {
      await api.deleteApiKey(key.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key')
    }
  }

  const copy = async (value: string, name = 'snippet') => {
    await navigator.clipboard.writeText(value)
    setCopied(name)
  }

  const displayKey = createdKey || 'wk_your_key_here'
  const httpSnippet = JSON.stringify(
    {
      mcpServers: {
        wikindie: {
          type: 'http',
          url: mcpUrl,
          headers: { Authorization: `Bearer ${displayKey}` },
        },
      },
    },
    null,
    2,
  )
  const stdioSnippet = JSON.stringify(
    {
      mcpServers: {
        wikindie: {
          command: 'node',
          args: ['/absolute/path/to/wikindie/packages/backend/dist/mcp-stdio.js'],
          env: {
            WIKINDIE_URL: mcpUrl,
            WIKINDIE_API_KEY: displayKey,
          },
        },
      },
    },
    null,
    2,
  )

  return (
    <div>
      {showHeader && (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded border border-info/30 bg-info/10 px-3 py-1 text-sm text-info">
              <PlugZap size={15} /> Connect to AI
            </div>
            <h2 className="text-2xl font-semibold text-text">Wikindie MCP</h2>
            <p className="mt-1 max-w-2xl text-sm text-text-muted">Generate a bearer key and connect local/dev agents through Streamable HTTP or the stdio bridge.</p>
          </div>
          <Button onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      )}
      {!showHeader && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-surface p-4">
          <div>
            <h3 className="font-semibold text-text">Your MCP connection</h3>
            <p className="mt-1 text-sm text-text-muted">Generate a personal key and copy local agent configuration snippets.</p>
          </div>
          <Button onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      )}

      {error && <div className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}
      {copied && <div className="mb-4 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">Copied {copied}.</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <form onSubmit={generate} className="rounded-md border border-border bg-surface p-4">
            <div className="mb-4 flex items-center gap-2 text-text">
              <KeyRound size={17} /> <h3 className="font-semibold">Generate MCP key</h3>
            </div>
            <div className="space-y-3">
              <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Label" className="w-full" />
              <select className="w-full rounded-md border border-border bg-input px-2 py-2 text-sm text-text outline-none focus:border-accent" value={role} onChange={(event) => setRole(event.target.value as Role)}>
                {availableRoles.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <Button variant="primary" type="submit" className="w-full justify-center">Generate key</Button>
            </div>
          </form>

          {createdKey && (
            <div className="rounded-md border border-success/40 bg-success/10 p-4">
              <p className="mb-2 text-sm font-semibold text-success">Copy this key now. It will not be shown again.</p>
              <code className="block break-all rounded-md border border-border bg-input p-3 text-sm text-text">{createdKey}</code>
              <Button className="mt-3" onClick={() => void copy(createdKey, 'key')}>
                <Copy size={14} /> Copy key
              </Button>
            </div>
          )}

          <div className="rounded-md border border-border bg-surface">
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-text transition hover:bg-accent/5"
              onClick={() => setShowActiveKeys(!showActiveKeys)}
            >
              <ChevronRight size={14} className={`text-text-muted transition ${showActiveKeys ? 'rotate-90' : ''}`} />
              Active keys
              {activeKeys.length > 0 && <span className="font-normal text-text-muted">{activeKeys.length}</span>}
            </button>
            {showActiveKeys && (
              <div className="space-y-3 border-t border-border p-4">
                {activeKeys.map((key) => (
                  <div key={key.id} className="rounded-md border border-border bg-input p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-text">{key.label}</div>
                        <div className="font-mono text-xs text-text-muted">{key.prefix}...</div>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${roleBadgeClass(key.role)}`}>{key.role}</span>
                    </div>
                    <div className="mt-2 text-xs text-text-muted">Last used: {formatDate(key.lastUsedAt)}</div>
                    <Button className="mt-3" variant="danger" onClick={() => void revoke(key)}>
                      <Trash2 size={14} /> Revoke
                    </Button>
                  </div>
                ))}
                {!activeKeys.length && <p className="text-sm text-text-muted">No active keys.</p>}
              </div>
            )}
          </div>

          {revokedKeys.length > 0 && (
            <div className="rounded-md border border-border bg-surface">
              <button
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-text-muted transition hover:text-text"
                onClick={() => setShowRevokedKeys(!showRevokedKeys)}
              >
                <ChevronRight size={14} className={`transition ${showRevokedKeys ? 'rotate-90' : ''}`} />
                <span className="font-medium">Revoked keys</span>
                <span className="text-xs">{revokedKeys.length}</span>
              </button>
              {showRevokedKeys && (
                <div className="space-y-3 border-t border-border p-4">
                  {revokedKeys.map((key) => (
                    <div key={key.id} className="rounded-md border border-border bg-input p-3 opacity-60">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-text line-through">{key.label}</div>
                          <div className="font-mono text-xs text-text-muted">{key.prefix}...</div>
                        </div>
                        <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-xs text-danger">revoked</span>
                      </div>
                      <div className="mt-2 text-xs text-text-muted">Revoked: {formatDate(key.revokedAt)}</div>
                      <Button className="mt-3" variant="ghost" onClick={() => void deleteKey(key)}>
                        <Trash2 size={14} /> Delete permanently
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text">Quick setup</h3>
          {clientConfigs.map((client) => {
            const isOpen = selectedClient === client.id
            const snippetValue = client.snippet(mcpUrl, displayKey)
            return (
              <div key={client.id} className="rounded-md border border-border bg-surface">
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-text transition hover:bg-accent/5"
                  onClick={() => setSelectedClient(isOpen ? null : client.id)}
                >
                  <ChevronRight size={14} className={`text-text-muted transition ${isOpen ? 'rotate-90' : ''}`} />
                  <client.icon size={16} />
                  <span className="flex-1">{client.label}</span>
                  {client.filePath && <span className="text-xs font-normal text-text-muted">{client.filePath}</span>}
                </button>
                {isOpen && (
                  <div className="border-t border-border">
                    <div className="flex items-center justify-end px-4 py-2">
                      <Button onClick={() => void copy(snippetValue, `${client.label} config`)}>
                        <Copy size={14} /> Copy
                      </Button>
                    </div>
                    <pre className="workspace-scroll max-h-[240px] overflow-auto px-4 pb-4 text-xs leading-relaxed text-text"><code>{snippetValue}</code></pre>
                  </div>
                )}
              </div>
            )
          })}

          <div className="rounded-md border border-border bg-surface">
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-text-muted transition hover:text-text"
              onClick={() => setSelectedClient(selectedClient === 'advanced' ? null : 'advanced')}
            >
              <ChevronRight size={14} className={`transition ${selectedClient === 'advanced' ? 'rotate-90' : ''}`} />
              <span className="font-medium">Generic HTTP & Stdio configs</span>
            </button>
            {selectedClient === 'advanced' && (
              <div className="space-y-4 border-t border-border p-4">
                <Snippet title="Streamable HTTP MCP" value={httpSnippet} onCopy={(value) => void copy(value, 'HTTP config')} />
                <Snippet title="Stdio Bridge MCP" value={stdioSnippet} onCopy={(value) => void copy(value, 'stdio config')} />
                <div className="text-sm text-text-muted">
                  <p>Use HTTP config for agents that support remote Streamable HTTP MCP. Use the stdio bridge for local clients that only launch MCP subprocesses.</p>
                  <p className="mt-2">Run <code className="rounded bg-input px-1 py-0.5 text-text">npm run build</code> before using the stdio bridge from this repo.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
