// Guards the agent memory store. Run `npm run build` first, then `npm run check:memory`.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.env.SPACE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'wikindie-memory-'))
const { recallEntries, recallIndex, remember, memoryPath } = await import('../packages/backend/dist/lib/memory.js')
const pageId = `pg_${'a'.repeat(32)}`
const note = (title, extra = {}) => remember(pageId, { kind: 'decision', title, author: 'agent', ...extra })

assert.match(await recallIndex(pageId), /^0 of 0/)

const first = await note('Use one font', { body: 'SECRET reason', task: 'WK-1', tags: ['look'] })
const second = await note('Ran the build', { kind: 'log' })

const index = await recallIndex(pageId)
assert.ok(index.includes(first.id) && !index.includes('SECRET'), 'the index must not carry bodies')
assert.ok(index.indexOf(second.id) < index.indexOf(first.id), 'newest first')
assert.ok((await recallEntries(pageId, [first.id])).includes('SECRET'), 'ids return the body')

assert.ok(!(await recallIndex(pageId, { kind: 'log' })).includes(first.id))
assert.ok((await recallIndex(pageId, { task: 'wk-1' })).includes(first.id))
assert.ok((await recallIndex(pageId, { query: 'secret' })).includes(first.id), 'query searches bodies')

const third = await note('Use two fonts', { replaces: first.id })
assert.ok(!(await recallIndex(pageId)).includes(`${first.id} `), 'a replaced note leaves the index')
assert.ok((await recallEntries(pageId, [first.id])).includes('SECRET'), 'a replaced note stays readable by id')
assert.ok((await recallIndex(pageId)).includes(third.id))
await assert.rejects(note('Bad', { replaces: 'm_missing' }), /No note/)

await fs.appendFile(memoryPath(pageId), '{"torn')
assert.ok((await recallIndex(pageId)).includes(third.id), 'a torn line must not hide other notes')
const afterCrash = await note('Saved after a crash')
assert.ok((await recallIndex(pageId)).includes(afterCrash.id), 'a note after a torn line must stay readable')
assert.throws(() => memoryPath('../../etc/passwd'), /Invalid page id/)

// The rules are added to _AGENT.md once, and existing text stays byte for byte.
const { editPageContent, ensureSpace, readPage } = await import('../packages/backend/dist/lib/files.js')
const { AGENT_RULES_MARKER } = await import('../packages/backend/dist/lib/defaultSpace.js')
const agentFile = path.join(process.env.SPACE_DIR, '_AGENT.md')
const mine = '---\nhidden: true\nid: pg_custom\n---\n# Mine\n\nOwner text with odd   spacing.\n'
await fs.writeFile(agentFile, mine)
await ensureSpace()
await ensureSpace()
const agentText = await fs.readFile(agentFile, 'utf8')
assert.ok(agentText.startsWith(mine), 'existing _AGENT.md text must stay untouched')
assert.equal(agentText.split(AGENT_RULES_MARKER).length - 1, 1, 'rules are added once')

// Parallel writers must not lose work, and parallel first reads must agree on one id.
const lines = Array.from({ length: 25 }, (_, i) => `line-${i}-old`)
await fs.writeFile(path.join(process.env.SPACE_DIR, 'Parallel.md'), `# Parallel\n\n${lines.join('\n\n')}\n`)
const parallelIds = await Promise.all(lines.map(() => readPage('Parallel').then((page) => page.id)))
assert.equal(new Set(parallelIds).size, 1, 'parallel first reads must agree on one page id')
await Promise.all(lines.map((line, i) => editPageContent('Parallel', (page) => page.content.replace(line, `line-${i}-new`))))
const parallelBody = (await readPage('Parallel')).content
lines.forEach((_, i) => assert.ok(parallelBody.includes(`line-${i}-new`), `edit ${i} was lost`))

await fs.rm(process.env.SPACE_DIR, { recursive: true, force: true })
console.log('memory checks passed')
