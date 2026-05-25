#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const files = [
  'package.json',
  'packages/backend/package.json',
  'packages/frontend/package.json',
]

const part = process.argv[2] || 'patch'
if (!['major', 'minor', 'patch'].includes(part)) {
  console.error(`Usage: node scripts/bump.mjs [major|minor|patch]  (default: patch)`)
  process.exit(1)
}

const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const [major, minor, patch] = rootPkg.version.split('.').map(Number)

const next =
  part === 'major' ? `${major + 1}.0.0` :
  part === 'minor' ? `${major}.${minor + 1}.0` :
                     `${major}.${minor}.${patch + 1}`

for (const file of files) {
  const path = resolve(root, file)
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  pkg.version = next
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n')
}

console.log(`${rootPkg.version} → ${next}`)
