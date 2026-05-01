import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const frontendDist = path.join(rootDir, 'packages/frontend/dist')
const backendPublic = path.join(rootDir, 'packages/backend/public')

await rm(backendPublic, { recursive: true, force: true })
await mkdir(backendPublic, { recursive: true })
await cp(frontendDist, backendPublic, { recursive: true })
