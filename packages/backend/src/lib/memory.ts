import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import { AppError } from './errors.js'
import { isPageId, safePath } from './files.js'

// Agent memory: one append-only JSONL file per project page, outside every page path.
// The .jsonl extension also keeps it out of the page routes, which only resolve .md files.

export const MEMORY_DIR = '.wikindie/memory'
export const MAX_TITLE = 120
export const MAX_BODY = 4000
export const memoryKinds = ['decision', 'log'] as const
export type MemoryKind = (typeof memoryKinds)[number]

export interface MemoryEntry {
  id: string
  at: string
  kind: MemoryKind
  title: string
  body?: string
  task?: string
  tags?: string[]
  author: string
  replaces?: string
}

export interface MemoryFilter {
  kind?: MemoryKind
  task?: string
  tag?: string
  query?: string
  limit?: number
}

export function memoryPath(pageId: string) {
  if (!isPageId(pageId)) throw new AppError(400, 'Invalid page id')
  return safePath(`${MEMORY_DIR}/${pageId}.jsonl`)
}

// ponytail: scans the whole file on each call, add a sidecar index if a project outgrows it.
async function readEntries(pageId: string): Promise<MemoryEntry[]> {
  let raw: string
  try {
    raw = await fs.readFile(memoryPath(pageId), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const entries: MemoryEntry[] = []
  for (const line of raw.split('\n')) {
    if (!line) continue
    try {
      entries.push(JSON.parse(line))
    } catch {
      // A torn last line from a crash must not hide the other notes.
    }
  }
  return entries
}

export async function remember(pageId: string, input: Omit<MemoryEntry, 'id' | 'at'>) {
  if (input.replaces && !(await readEntries(pageId)).some((entry) => entry.id === input.replaces)) {
    throw new AppError(404, `No note ${input.replaces} on this project`)
  }
  const entry: MemoryEntry = { id: `m_${randomBytes(4).toString('hex')}`, at: new Date().toISOString(), ...input }
  await fs.mkdir(safePath(MEMORY_DIR), { recursive: true })
  // The leading newline ends any partial last line, the trailing one protects this record from the next crash.
  await fs.appendFile(memoryPath(pageId), `\n${JSON.stringify(entry)}\n`, 'utf8')
  return entry
}

function matches(entry: MemoryEntry, filter: MemoryFilter) {
  if (filter.kind && entry.kind !== filter.kind) return false
  if (filter.task && entry.task?.toLowerCase() !== filter.task.toLowerCase()) return false
  if (filter.tag && !entry.tags?.some((tag) => tag.toLowerCase() === filter.tag?.toLowerCase())) return false
  if (filter.query) {
    const haystack = `${entry.title}\n${entry.body ?? ''}\n${(entry.tags ?? []).join(' ')}`.toLowerCase()
    if (!haystack.includes(filter.query.toLowerCase())) return false
  }
  return true
}

function indexLine(entry: MemoryEntry) {
  const task = entry.task ? ` ${entry.task}` : ''
  const tags = entry.tags?.length ? ` [${entry.tags.join(', ')}]` : ''
  return `${entry.id} ${entry.at.slice(0, 10)} ${entry.kind}${task}${tags}: ${entry.title}`
}

// One line per live note, newest first. Bodies stay out so an index stays cheap to read.
export async function recallIndex(pageId: string, filter: MemoryFilter = {}) {
  const entries = await readEntries(pageId)
  const replaced = new Set(entries.map((entry) => entry.replaces).filter(Boolean))
  const found = entries.filter((entry) => !replaced.has(entry.id) && matches(entry, filter)).reverse()
  const shown = found.slice(0, filter.limit ?? 30)
  const header = `${shown.length} of ${found.length} matching notes (${entries.length} stored). Pass ids to read bodies.`
  return [header, ...shown.map(indexLine)].join('\n')
}

export async function recallEntries(pageId: string, ids: string[]) {
  const wanted = new Set(ids)
  const found = (await readEntries(pageId)).filter((entry) => wanted.has(entry.id))
  if (!found.length) return 'No matching notes.'
  return found
    .map((entry) => `${indexLine(entry)}\nby ${entry.author}${entry.replaces ? `, replaces ${entry.replaces}` : ''}${entry.body ? `\n\n${entry.body}` : ''}`)
    .join('\n\n---\n\n')
}
