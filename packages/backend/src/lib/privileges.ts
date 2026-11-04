import fs from 'node:fs/promises'
import path from 'node:path'
import { SPACE_DIR } from './files.js'

// lstat/lchown so a symlink in the workspace can never redirect a root chown outside it.
async function chownTree(target: string, uid: number, gid: number): Promise<number> {
  const stat = await fs.lstat(target)
  let changed = 0
  if (stat.uid !== uid || stat.gid !== gid) {
    await fs.lchown(target, uid, gid)
    changed = 1
  }
  if (!stat.isDirectory()) return changed
  for (const entry of await fs.readdir(target)) changed += await chownTree(path.join(target, entry), uid, gid)
  return changed
}

// Under rootless Docker or Podman, uid 0 is really the host user. Handing files to uid 1000
// would lock that user out of their own workspace, so only real root migrates.
async function isHostRoot() {
  if (process.getuid?.() !== 0) return false
  const [, hostUid] = (await fs.readFile('/proc/self/uid_map', 'utf8')).trim().split(/\s+/)
  return hostUid === '0'
}

// Images before 0.8 ran as root, so existing workspaces are root-owned. When the image is started
// as root, take ownership of the workspace and switch for good, before anything else touches it.
// WIKINDIE_RUN_AS is set by the Dockerfile, so a bare-metal `sudo npm start` is left alone.
export async function dropPrivileges() {
  const runAs = process.env.WIKINDIE_RUN_AS
  if (!runAs) return
  const [uid, gid] = runAs.split(':').map(Number)
  try {
    if (!(await isHostRoot())) return
    await fs.mkdir(SPACE_DIR, { recursive: true })
    const changed = await chownTree(SPACE_DIR, uid, gid)
    process.setgroups?.([])
    process.setgid?.(gid)
    process.setuid?.(uid)
    if (changed > 0) console.log(`Changed the owner of ${changed} items in ${SPACE_DIR} to ${runAs}.`)
  } catch (err) {
    // Staying root matches how older images ran, so the workspace keeps working.
    console.warn(`Could not switch to ${runAs}, still running as root: ${err instanceof Error ? err.message : err}. To fix it, run chown -R ${runAs} on the workspace and start the container with --user ${runAs}.`)
  }
}
