#!/usr/bin/env node
// Capture launch/marketing screenshots from a running Wikindie instance.
//
// Usage:
//   npm install --save-dev playwright
//   npx playwright install chromium
//   node scripts/screenshots.mjs
//
// Credentials resolution (first match wins):
//   1. WIKINDIE_LOGIN_USER / WIKINDIE_LOGIN_PASS env vars
//   2. WIKINDIE_USER env var (format user:pass); same shape the backend uses
//   3. WIKINDIE_USER from a .env file in the repo root (the script parses it manually
//      because Node doesn't auto-load .env)
//   4. dev:dev fallback (only useful for a stock dev backend)
//
// Target URL resolution (first match wins):
//   1. Local Vite dev server at http://localhost:5173 if its port is open
//   2. WIKINDIE_URL env var (or `.env` value)
//   3. http://localhost:5173 fallback (will fail fast if nothing is running)
//
// Other env overrides:
//   WIKINDIE_THEME       light | dark   (default: leave site default)
//   WIKINDIE_OUT_DIR     (default: assets/screenshots)
//   WIKINDIE_HERO_PAGE   page path for the hero shot
//                        (default local: Workspace; showcase: Wikindie)
//   WIKINDIE_BOARD_PAGE  page path for the kanban shot
//                        (default local: Workspace/Planning/Portfolio Board;
//                         showcase: Wikindie/Roadmap)
//
// Examples:
//   # local dev server (Vite); creds picked up from .env or shell
//   node scripts/screenshots.mjs
//
//   # explicit creds, override .env
//   WIKINDIE_LOGIN_USER=admin WIKINDIE_LOGIN_PASS=*** node scripts/screenshots.mjs
//
//   # live showcase, public-readonly shots only (auth shots will be skipped)
//   WIKINDIE_URL=https://wikindie.dexgamedev.com node scripts/screenshots.mjs

import { chromium } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setDefaultResultOrder } from 'node:dns'
import net from 'node:net'

// Node 22 undici fetch resolves `localhost` to ::1 (IPv6) by default; Vite only
// binds 127.0.0.1, so fetch() fails with "fetch failed". Force IPv4-first.
setDefaultResultOrder('ipv4first')

function parseDotEnv(text) {
  const out = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

async function loadDotEnv(path) {
  try { return parseDotEnv(await readFile(path, 'utf8')) } catch { return {} }
}

function splitUserPass(raw) {
  if (!raw || !raw.includes(':')) return ['', '']
  const idx = raw.indexOf(':')
  return [raw.slice(0, idx), raw.slice(idx + 1)]
}

function probePort(host, port, timeoutMs = 400) {
  return new Promise((resolveProbe) => {
    const socket = net.createConnection({ host, port })
    const finish = (ok) => { socket.destroy(); resolveProbe(ok) }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.setTimeout(timeoutMs, () => finish(false))
  })
}

const dotenv = await loadDotEnv(resolve(process.cwd(), '.env'))
const wikindieUser = process.env.WIKINDIE_USER ?? dotenv.WIKINDIE_USER ?? ''
const [envUser, envPass] = splitUserPass(wikindieUser)

const LOCAL_DEV_URL = 'http://localhost:5173'
const envUrl = (process.env.WIKINDIE_URL || dotenv.WIKINDIE_URL || '').replace(/\/$/, '')
const localUp = await probePort('127.0.0.1', 5173)
const BASE_URL = localUp ? LOCAL_DEV_URL : (envUrl || LOCAL_DEV_URL)
const BASE_SOURCE = localUp ? 'local dev server' : envUrl ? 'WIKINDIE_URL env' : 'fallback (no local dev, no env set)'
const USER = process.env.WIKINDIE_LOGIN_USER || envUser || 'dev'
const PASS = process.env.WIKINDIE_LOGIN_PASS || envPass || 'dev'
const THEME = process.env.WIKINDIE_THEME ?? ''
const OUT_DIR = resolve(process.cwd(), process.env.WIKINDIE_OUT_DIR ?? 'assets/screenshots')

// Default page targets pick whichever pages actually exist in the workspace being
// shot. The live showcase ships marketing-specific `Wikindie/*` pages; the local
// seeded dev space ships generic `Workspace/*` pages. Override per shot if needed.
const isShowcase = /wikindie\.dexgamedev\.com$/i.test(new URL(BASE_URL).host)
const HERO_PAGE = process.env.WIKINDIE_HERO_PAGE || (isShowcase ? 'Wikindie' : 'Workspace')
const BOARD_PAGE = process.env.WIKINDIE_BOARD_PAGE || (isShowcase ? 'Wikindie/Roadmap' : 'Workspace/Planning/Portfolio Board')
const pagePath = (p) => `/page/${p.split('/').map(encodeURIComponent).join('/')}`

const DESKTOP = { width: 1920, height: 1080 }
const MOBILE = { width: 414, height: 896 }

// `unauth: true` shots run in a fresh context with no session injected, so
// auth-gated routes render their logged-out state (e.g. /login shows the form
// instead of redirecting home). `prepare` runs after page load and before the
// screenshot, useful for clearing dev-mode prefilled state.
const clearLoginInputs = async (page) => {
  await page.fill('input[autocomplete="username"]', '').catch(() => {})
  await page.fill('input[autocomplete="current-password"]', '').catch(() => {})
  await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur()).catch(() => {})
}

/** @type {Array<{ name: string, path: string, auth: boolean, unauth?: boolean, viewport: { width: number, height: number }, settle?: number, prepare?: (page: any) => Promise<void> }>} */
const SHOTS = [
  { name: 'login',           path: '/login',              auth: false, unauth: true, viewport: DESKTOP, prepare: clearLoginInputs },
  { name: 'hero-page',       path: pagePath(HERO_PAGE),   auth: false, viewport: DESKTOP },
  { name: 'kanban-roadmap',  path: pagePath(BOARD_PAGE),  auth: false, viewport: DESKTOP },
  { name: 'welcome',         path: '/',                   auth: true,  viewport: DESKTOP },
  { name: 'connect-ai',      path: '/admin?tab=ai',       auth: true,  viewport: DESKTOP },
  { name: 'mobile-page',     path: pagePath(HERO_PAGE),   auth: false, viewport: MOBILE },
  { name: 'mobile-kanban',   path: pagePath(BOARD_PAGE),  auth: false, viewport: MOBILE },
]

async function applyTheme(page) {
  if (!THEME) return
  await page.addInitScript((theme) => {
    try { localStorage.setItem('wikindie:theme', theme) } catch {}
  }, THEME)
}

async function injectSession(context, token, username, role) {
  await context.addInitScript(({ t, u, r }) => {
    try {
      localStorage.setItem('wikindie:token', t)
      localStorage.setItem('wikindie:username', u)
      if (r) localStorage.setItem('wikindie:role', r)
    } catch {}
  }, { t: token, u: username, r: role ?? '' })
}

async function acquireSession() {
  const loginUrl = `${BASE_URL}/api/auth/login`
  const res = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const detail = body ? `: ${body.slice(0, 140)}` : ''
    throw new Error(`POST ${loginUrl} as "${USER}" → ${res.status}${detail}`)
  }
  const data = await res.json()
  return { token: data.token, username: data.user?.username ?? USER, role: data.user?.role }
}

async function shoot(browser, shot, session) {
  if (shot.auth && !session) {
    console.warn(`⊘ ${shot.name}: skipped (auth required, no session)`)
    return
  }
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: 2,
  })
  if (session && !shot.unauth) await injectSession(context, session.token, session.username, session.role)
  const page = await context.newPage()
  await applyTheme(page)
  try {
    await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(shot.settle ?? 900)
    if (shot.prepare) await shot.prepare(page)
    const out = resolve(OUT_DIR, `${shot.name}.png`)
    await page.screenshot({ path: out, fullPage: false })
    console.log(`✔ ${shot.name.padEnd(18)} → ${out}`)
  } catch (err) {
    console.error(`✘ ${shot.name}: ${err.message}`)
  } finally {
    await context.close()
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  console.log(`• target: ${BASE_URL} (${BASE_SOURCE})`)

  let session = null
  try {
    session = await acquireSession()
    console.log(`• logged in as ${session.username} (${session.role ?? 'user'})`)
  } catch (err) {
    console.warn(`⚠ login failed: ${err.message}`)
    console.warn(`  auth-required shots will be skipped. To fix:`)
    console.warn(`    • set WIKINDIE_USER=user:pass in .env (root), or`)
    console.warn(`    • run: WIKINDIE_LOGIN_USER=<u> WIKINDIE_LOGIN_PASS=<p> npm run screenshots`)
  }

  const browser = await chromium.launch()
  try {
    for (const shot of SHOTS) {
      await shoot(browser, shot, session)
    }
  } finally {
    await browser.close()
  }

  console.log(`\nDone. Output: ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
