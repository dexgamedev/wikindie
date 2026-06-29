import { createRequire } from 'node:module'

// Reuse emoji-mart's standard native emoji dataset (the same pool the editor's
// emoji picker uses) instead of maintaining our own list. Loaded via createRequire
// so we read the package's JSON main without import-attribute friction under NodeNext.
const require = createRequire(import.meta.url)

interface EmojiMartSkin { native: string }
interface EmojiMartEmoji { id: string; skins: EmojiMartSkin[] }
interface EmojiMartData {
  emojis: Record<string, EmojiMartEmoji>
  aliases: Record<string, string>
}

// Legacy friendly ids (the original hand-curated pool) kept so existing
// frontmatter and agent input using these ids still resolve to a glyph.
const legacyIconGlyphs: Record<string, string> = {
  page: '📄', home: '🏠', folder: '📁', star: '⭐', pin: '📌',
  project: '🎮', game: '🕹️', prototype: '🧪', idea: '💡', mechanics: '⚙️',
  map: '🗺️', quest: '📜', character: '🧙', combat: '⚔️', inventory: '🎒',
  devlog: '📝', board: '📊', column: '📋', roadmap: '🛣️', calendar: '📅',
  target: '🎯', rocket: '🚀', art: '🎨', image: '🖼️', music: '🎵',
  sound: '🔊', writing: '✍️', code: '💻', tool: '🛠️', bug: '🐛',
  performance: '⚡', package: '📦', todo: '⬜', doing: '🔄', done: '✅',
  blocked: '⛔', warning: '⚠️',
}

let glyphByShortcode: Map<string, string> | null = null

function buildShortcodeMap(): Map<string, string> {
  const map = new Map<string, string>()
  try {
    const data = require('@emoji-mart/data') as EmojiMartData
    for (const [id, emoji] of Object.entries(data.emojis)) {
      const native = emoji?.skins?.[0]?.native
      if (native) map.set(id, native)
    }
    for (const [alias, id] of Object.entries(data.aliases ?? {})) {
      const native = data.emojis[id]?.skins?.[0]?.native
      if (native && !map.has(alias)) map.set(alias, native)
    }
  } catch {
    // Dataset unavailable: fall back to legacy ids only.
  }
  // Legacy ids win for back-compat (e.g. `rocket` already matches, but `project`
  // is not an emoji-mart shortcode and must map to the original glyph).
  for (const [id, glyph] of Object.entries(legacyIconGlyphs)) map.set(id, glyph)
  return map
}

/**
 * Normalize a page icon to a raw emoji glyph for storage.
 * Accepts a glyph (returned as-is), an emoji-mart shortcode (`rocket` or `:rocket:`),
 * or a legacy friendly id (`project`). Unknown values are returned untouched so the
 * frontend can still fall back; nothing is rejected.
 */
export function normalizeIcon(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (!glyphByShortcode) glyphByShortcode = buildShortcodeMap()
  const key = trimmed.replace(/^:|:$/g, '').toLowerCase()
  return glyphByShortcode.get(key) ?? trimmed
}
