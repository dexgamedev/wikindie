import * as oidc from 'openid-client'
import { oidcEnabled } from './config.js'
import { isRole, type Role } from './jwt.js'

// Everything here is inert unless `oidcEnabled` (see config.ts). The heavy
// openid-client import lives in this module so the rest of the backend never
// pulls it in when SSO is off.

function csv(name: string) {
  return String(process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

const truthyValues = new Set(['1', 'true', 'yes', 'on'])
function envFlag(name: string) {
  return truthyValues.has(String(process.env[name] ?? '').trim().toLowerCase())
}

function coerceRole(value: string | undefined): Role | null {
  const normalized = value?.trim()
  return isRole(normalized) ? normalized : null
}

const scope = process.env.OIDC_SCOPES?.trim() || 'openid profile email'
const usernameClaim = process.env.OIDC_USERNAME_CLAIM?.trim() || 'preferred_username'
const groupsClaim = process.env.OIDC_GROUPS_CLAIM?.trim() || 'groups'
const adminGroups = new Set(csv('OIDC_ADMIN_GROUPS'))
const editorGroups = new Set(csv('OIDC_EDITOR_GROUPS'))
const readonlyGroups = new Set(csv('OIDC_READONLY_GROUPS'))
const defaultRole = coerceRole(process.env.OIDC_DEFAULT_ROLE) ?? 'readonly'
const hasGroupMapping = adminGroups.size > 0 || editorGroups.size > 0 || readonlyGroups.size > 0
// Group mappings always seed a user's role on first login. Whether they also
// overwrite the role on every subsequent login (IdP as source of truth) is a
// separate, opt-in choice: with sync off, roles changed in the UI persist.
const syncRoles = envFlag('OIDC_SYNC_ROLES')
const allowInsecure = envFlag('OIDC_ALLOW_INSECURE')

export interface OidcProfile {
  subject: string
  username: string
  role: Role
  /** When true the mapped role should be kept in sync on every login. */
  syncRole: boolean
}

export interface OidcTransaction {
  state: string
  nonce: string
  codeVerifier: string
  redirectUri: string
}

let configPromise: Promise<oidc.Configuration> | null = null

async function getConfig() {
  if (!oidcEnabled) throw new Error('OIDC is not enabled')
  if (configPromise) return configPromise

  const issuer = process.env.OIDC_ISSUER!.trim()
  const clientId = process.env.OIDC_CLIENT_ID!.trim()
  const clientSecret = process.env.OIDC_CLIENT_SECRET?.trim() || undefined

  configPromise = oidc
    .discovery(new URL(issuer), clientId, clientSecret, undefined, {
      execute: allowInsecure ? [oidc.allowInsecureRequests] : undefined,
    })
    .catch((error) => {
      // Reset so a transient discovery failure (e.g. IdP not up yet) can retry.
      configPromise = null
      throw error
    })

  return configPromise
}

export function resolveRedirectUri(protocol: string, host: string | undefined) {
  const explicit = process.env.OIDC_REDIRECT_URI?.trim()
  if (explicit) return explicit
  return `${protocol}://${host ?? ''}/api/auth/oidc/callback`
}

export async function createAuthorizationRequest(redirectUri: string) {
  const config = await getConfig()
  const codeVerifier = oidc.randomPKCECodeVerifier()
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier)
  const state = oidc.randomState()
  const nonce = oidc.randomNonce()

  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  })

  return { url: url.href, state, nonce, codeVerifier }
}

function claimsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function extractGroups(claims: Record<string, unknown>): string[] {
  const raw = claims[groupsClaim]
  if (Array.isArray(raw)) return raw.map((group) => String(group).toLowerCase())
  if (typeof raw === 'string') return raw.split(/[,\s]+/).map((g) => g.toLowerCase()).filter(Boolean)
  return []
}

function roleFromClaims(claims: Record<string, unknown>): Role {
  if (!hasGroupMapping) return defaultRole
  const groups = new Set(extractGroups(claims))
  if ([...adminGroups].some((group) => groups.has(group))) return 'admin'
  if ([...editorGroups].some((group) => groups.has(group))) return 'editor'
  if ([...readonlyGroups].some((group) => groups.has(group))) return 'readonly'
  return defaultRole
}

function usernameFromClaims(claims: Record<string, unknown>): string {
  const primary = claims[usernameClaim]
  if (typeof primary === 'string' && primary.trim()) return primary.trim()
  if (typeof claims.email === 'string' && claims.email.trim()) return claims.email.trim()
  return String(claims.sub)
}

export async function completeAuthorization(currentUrl: URL, tx: OidcTransaction): Promise<OidcProfile> {
  const config = await getConfig()
  const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: tx.codeVerifier,
    expectedNonce: tx.nonce,
    expectedState: tx.state,
    idTokenExpected: true,
  })

  let claims = claimsRecord(tokens.claims())
  const subject = String(claims.sub ?? '')
  if (!subject) throw new Error('OIDC id_token is missing a subject')

  // Group memberships often live in userinfo rather than the id_token. Fetch it
  // when the configured groups claim is absent and we actually need groups.
  if (hasGroupMapping && !(groupsClaim in claims) && tokens.access_token) {
    try {
      const info = await oidc.fetchUserInfo(config, tokens.access_token, subject)
      claims = { ...claims, ...claimsRecord(info) }
    } catch {
      // Best-effort: fall back to whatever the id_token carried.
    }
  }

  return {
    subject,
    username: usernameFromClaims(claims),
    role: roleFromClaims(claims),
    syncRole: syncRoles,
  }
}
