import type { NextFunction, Request, Response } from 'express'
import { AppError } from './errors.js'

const truthyValues = new Set(['1', 'true', 'yes', 'on'])

function envFlag(name: string) {
  return truthyValues.has(String(process.env[name] ?? '').trim().toLowerCase())
}

function csvEnv(name: string) {
  return String(process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

export const publicReadonly = envFlag('WIKINDIE_PUBLIC_READONLY')
export const publicDefaultPage = process.env.WIKINDIE_PUBLIC_DEFAULT_PAGE?.trim() || ''
export const allowedHosts = new Set(csvEnv('WIKINDIE_ALLOWED_HOSTS'))
export const corsOrigins = new Set(csvEnv('WIKINDIE_CORS_ORIGINS'))

export function hostnameFromHostHeader(hostHeader: string | string[] | undefined) {
  const value = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
  if (!value) return ''

  const host = value.trim().toLowerCase()
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    return end > 0 ? host.slice(1, end) : host
  }

  return host.split(':')[0]
}

export function isAllowedHostHeader(hostHeader: string | string[] | undefined) {
  if (!allowedHosts.size) return true
  const hostname = hostnameFromHostHeader(hostHeader)
  return Boolean(hostname && allowedHosts.has(hostname))
}

export function requireAllowedHost(req: Request, _res: Response, next: NextFunction) {
  if (isAllowedHostHeader(req.headers.host)) {
    next()
    return
  }

  throw new AppError(404, 'Not found')
}

export function isPublicReadRequest(req: Request) {
  return publicReadonly && (req.method === 'GET' || req.method === 'HEAD')
}

export function isAllowedCorsOrigin(origin: string | undefined) {
  if (!origin) return true

  if (corsOrigins.size) return corsOrigins.has(origin.toLowerCase())
  if (!allowedHosts.size) return true

  try {
    return allowedHosts.has(new URL(origin).hostname.toLowerCase())
  } catch {
    return false
  }
}

export function publicConfig() {
  return {
    publicReadonly,
    publicDefaultPage,
  }
}
