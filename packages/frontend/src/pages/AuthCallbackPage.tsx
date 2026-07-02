import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore, type Role } from '../lib/store'

const roles: Role[] = ['admin', 'editor', 'readonly']
function isRole(value: string | null): value is Role {
  return value !== null && (roles as string[]).includes(value)
}

/**
 * Lands here after the OIDC provider round-trip. The backend hands the freshly
 * minted session token via the URL fragment (never the query string, so it is
 * not logged by proxies), we persist it, then bounce to the app.
 */
export function AuthCallbackPage() {
  const setSession = useAuthStore((state) => state.setSession)
  const [outcome, setOutcome] = useState<'pending' | 'done' | 'error'>('pending')

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const token = params.get('token')
    const username = params.get('username')
    const role = params.get('role')

    if (token && username && isRole(role)) {
      setSession(token, username, role)
      // Drop the fragment so the token does not linger in the address bar.
      window.history.replaceState(null, '', window.location.pathname)
      setOutcome('done')
    } else {
      setOutcome('error')
    }
  }, [setSession])

  if (outcome === 'done') return <Navigate to="/" replace />
  if (outcome === 'error') return <Navigate to="/login?error=SSO+login+failed" replace />

  return <div className="grid h-screen place-items-center text-sm text-text-muted">Signing you in…</div>
}
