import { Copy, KeyRound, RefreshCw, Shield, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { adminApi, type AdminApiKey, type AdminUser } from '../lib/adminApi'
import { roleBadgeClass } from '../lib/badges'
import type { Role } from '../lib/store'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const roles: Role[] = ['admin', 'editor', 'readonly']

function formatDate(value: string | null) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function RoleSelect({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <select
      className="rounded-md border border-border bg-input px-2 py-2 text-sm text-text outline-none focus:border-accent"
      value={value}
      onChange={(event) => onChange(event.target.value as Role)}
    >
      {roles.map((role) => (
        <option key={role} value={role}>{role}</option>
      ))}
    </select>
  )
}

export function AdminPage() {
  const [tab, setTab] = useState<'users' | 'keys'>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [apiKeys, setApiKeys] = useState<AdminApiKey[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdKey, setCreatedKey] = useState('')
  const [copied, setCopied] = useState(false)

  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<Role>('editor')
  const [keyLabel, setKeyLabel] = useState('')
  const [keyRole, setKeyRole] = useState<Role>('readonly')

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])

  const refresh = async () => {
    setError('')
    setLoading(true)
    try {
      const [userResult, keyResult] = await Promise.all([adminApi.users(), adminApi.apiKeys()])
      setUsers(userResult.users)
      setApiKeys(keyResult.keys)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const result = await adminApi.createUser(newUsername, newPassword, newRole)
      setUsers((current) => [...current, result.user])
      setNewUsername('')
      setNewPassword('')
      setNewRole('editor')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    }
  }

  const updateRole = async (user: AdminUser, role: Role) => {
    setError('')
    try {
      const result = await adminApi.updateUserRole(user.id, role)
      setUsers((current) => current.map((item) => (item.id === user.id ? result.user : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  const deleteUser = async (user: AdminUser) => {
    if (!window.confirm(`Delete user ${user.username}?`)) return
    setError('')
    try {
      await adminApi.deleteUser(user.id)
      setUsers((current) => current.filter((item) => item.id !== user.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const generateKey = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setCreatedKey('')
    setCopied(false)
    try {
      const result = await adminApi.generateApiKey(keyLabel, keyRole)
      setApiKeys((current) => [...current, result.record])
      setCreatedKey(result.key)
      setKeyLabel('')
      setKeyRole('readonly')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate API key')
    }
  }

  const copyCreatedKey = async () => {
    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
  }

  const revokeKey = async (key: AdminApiKey) => {
    if (!window.confirm(`Revoke API key ${key.prefix}?`)) return
    setError('')
    try {
      await adminApi.revokeApiKey(key.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key')
    }
  }

  return (
    <section className="workspace-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded border border-info/30 bg-info/10 px-3 py-1 text-sm text-info">
            <Shield size={15} /> Admin Console
          </div>
          <h2 className="text-2xl font-semibold text-text">Users and API keys</h2>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">Manage local Wikindie accounts, role permissions, and bearer keys for integrations.</p>
        </div>
        <Button onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="mb-5 flex gap-2 rounded-md border border-border bg-surface p-1">
        <button className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${tab === 'users' ? 'bg-accent text-white' : 'bg-control text-text-muted hover:bg-control-hover hover:text-text'}`} onClick={() => setTab('users')}>Users</button>
        <button className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${tab === 'keys' ? 'bg-accent text-white' : 'bg-control text-text-muted hover:bg-control-hover hover:text-text'}`} onClick={() => setTab('keys')}>API Keys</button>
      </div>

      {error && <div className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      {tab === 'users' ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-md border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text">{user.username}</div>
                        <div className="text-xs text-text-muted">{user.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${roleBadgeClass(user.role)}`}>{user.role}</span>
                          <RoleSelect value={user.role} onChange={(role) => void updateRole(user, role)} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="danger" onClick={() => void deleteUser(user)}>
                          <Trash2 size={14} /> Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!users.length && (
                    <tr>
                      <td className="px-4 py-8 text-center text-text-muted" colSpan={4}>No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <form onSubmit={createUser} className="rounded-md border border-border bg-surface p-4">
            <div className="mb-4 flex items-center gap-2 text-text">
              <UserPlus size={17} /> <h3 className="font-semibold">Add user</h3>
            </div>
            <div className="space-y-3">
              <Input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="Username" className="w-full" />
              <Input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Temporary password" type="password" className="w-full" />
              <RoleSelect value={newRole} onChange={setNewRole} />
              <Button variant="primary" type="submit" className="w-full justify-center">Create user</Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {createdKey && (
              <div className="rounded-md border border-success/40 bg-success/10 p-4">
                <p className="mb-2 text-sm font-semibold text-success">Copy this key now. It will not be shown again.</p>
                <code className="block break-all rounded-md border border-border bg-input p-3 text-sm text-text">{createdKey}</code>
                <Button className="mt-3" onClick={() => void copyCreatedKey()}>
                  <Copy size={14} /> {copied ? 'Copied' : 'Copy key'}
                </Button>
              </div>
            )}

            <div className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-4 py-3">Key</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Last used</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((key) => (
                      <tr key={key.id} className="border-b border-border/70 last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-medium text-text">{key.label}</div>
                          <div className="font-mono text-xs text-text-muted">{key.prefix}...</div>
                        </td>
                        <td className="px-4 py-3 text-text-muted">{userById.get(key.userId)?.username ?? key.userId}</td>
                        <td className="px-4 py-3"><span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${roleBadgeClass(key.role)}`}>{key.role}</span></td>
                        <td className="px-4 py-3 text-text-muted">{formatDate(key.lastUsedAt)}</td>
                        <td className="px-4 py-3 text-text-muted">{key.revokedAt ? `Revoked ${formatDate(key.revokedAt)}` : 'Active'}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="danger" onClick={() => void revokeKey(key)} disabled={Boolean(key.revokedAt)}>
                            <Trash2 size={14} /> Revoke
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!apiKeys.length && (
                      <tr>
                        <td className="px-4 py-8 text-center text-text-muted" colSpan={6}>No API keys generated.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <form onSubmit={generateKey} className="rounded-md border border-border bg-surface p-4">
            <div className="mb-4 flex items-center gap-2 text-text">
              <KeyRound size={17} /> <h3 className="font-semibold">Generate API key</h3>
            </div>
            <div className="space-y-3">
              <Input value={keyLabel} onChange={(event) => setKeyLabel(event.target.value)} placeholder="Label, e.g. CI read access" className="w-full" />
              <RoleSelect value={keyRole} onChange={setKeyRole} />
              <Button variant="primary" type="submit" className="w-full justify-center">Generate key</Button>
            </div>
          </form>
        </div>
      )}
      </div>
    </section>
  )
}
