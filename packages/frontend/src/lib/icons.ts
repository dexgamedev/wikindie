export interface WikiIcon {
  id: string
  label: string
  glyph: string
  category: 'General' | 'Game Design' | 'Production' | 'Creative' | 'Technical' | 'Status'
  keywords: string[]
}

export const wikiIcons: WikiIcon[] = [
  { id: 'page', label: 'Page', glyph: '📄', category: 'General', keywords: ['document', 'note', 'file'] },
  { id: 'home', label: 'Home', glyph: '🏠', category: 'General', keywords: ['workspace', 'start', 'hub'] },
  { id: 'folder', label: 'Folder', glyph: '📁', category: 'General', keywords: ['collection', 'group', 'directory'] },
  { id: 'star', label: 'Star', glyph: '⭐', category: 'General', keywords: ['important', 'favorite'] },
  { id: 'pin', label: 'Pin', glyph: '📌', category: 'General', keywords: ['pinned', 'remember'] },
  { id: 'project', label: 'Project', glyph: '🎮', category: 'Game Design', keywords: ['game', 'controller', 'play'] },
  { id: 'game', label: 'Game', glyph: '🕹️', category: 'Game Design', keywords: ['arcade', 'playable'] },
  { id: 'prototype', label: 'Prototype', glyph: '🧪', category: 'Game Design', keywords: ['experiment', 'test', 'lab'] },
  { id: 'idea', label: 'Idea', glyph: '💡', category: 'Game Design', keywords: ['concept', 'design', 'thought'] },
  { id: 'mechanics', label: 'Mechanics', glyph: '⚙️', category: 'Game Design', keywords: ['systems', 'rules', 'loop'] },
  { id: 'map', label: 'Map', glyph: '🗺️', category: 'Game Design', keywords: ['world', 'level', 'area'] },
  { id: 'quest', label: 'Quest', glyph: '📜', category: 'Game Design', keywords: ['mission', 'story', 'task'] },
  { id: 'character', label: 'Character', glyph: '🧙', category: 'Game Design', keywords: ['player', 'npc', 'hero'] },
  { id: 'combat', label: 'Combat', glyph: '⚔️', category: 'Game Design', keywords: ['battle', 'fight', 'weapon'] },
  { id: 'inventory', label: 'Inventory', glyph: '🎒', category: 'Game Design', keywords: ['items', 'bag', 'loot'] },
  { id: 'devlog', label: 'Devlog', glyph: '📝', category: 'Production', keywords: ['journal', 'progress', 'log'] },
  { id: 'board', label: 'Board', glyph: '📊', category: 'Production', keywords: ['kanban', 'tasks', 'planning', 'chart'] },
  { id: 'column', label: 'Column', glyph: '📋', category: 'Production', keywords: ['kanban', 'lane', 'list', 'cards'] },
  { id: 'roadmap', label: 'Roadmap', glyph: '🛣️', category: 'Production', keywords: ['milestones', 'plan'] },
  { id: 'calendar', label: 'Calendar', glyph: '📅', category: 'Production', keywords: ['date', 'schedule'] },
  { id: 'target', label: 'Target', glyph: '🎯', category: 'Production', keywords: ['goal', 'focus'] },
  { id: 'rocket', label: 'Rocket', glyph: '🚀', category: 'Production', keywords: ['launch', 'release'] },
  { id: 'art', label: 'Art', glyph: '🎨', category: 'Creative', keywords: ['visual', 'paint', 'style'] },
  { id: 'image', label: 'Image', glyph: '🖼️', category: 'Creative', keywords: ['reference', 'screenshot'] },
  { id: 'music', label: 'Music', glyph: '🎵', category: 'Creative', keywords: ['audio', 'soundtrack'] },
  { id: 'sound', label: 'Sound', glyph: '🔊', category: 'Creative', keywords: ['sfx', 'audio'] },
  { id: 'writing', label: 'Writing', glyph: '✍️', category: 'Creative', keywords: ['narrative', 'copy', 'story'] },
  { id: 'code', label: 'Code', glyph: '💻', category: 'Technical', keywords: ['programming', 'implementation'] },
  { id: 'tool', label: 'Tool', glyph: '🛠️', category: 'Technical', keywords: ['utility', 'workflow'] },
  { id: 'bug', label: 'Bug', glyph: '🐛', category: 'Technical', keywords: ['issue', 'fix', 'problem'] },
  { id: 'performance', label: 'Performance', glyph: '⚡', category: 'Technical', keywords: ['speed', 'optimization'] },
  { id: 'package', label: 'Package', glyph: '📦', category: 'Technical', keywords: ['build', 'asset', 'bundle'] },
  { id: 'todo', label: 'To Do', glyph: '⬜', category: 'Status', keywords: ['pending', 'open'] },
  { id: 'doing', label: 'Doing', glyph: '🔄', category: 'Status', keywords: ['progress', 'active'] },
  { id: 'done', label: 'Done', glyph: '✅', category: 'Status', keywords: ['complete', 'finished'] },
  { id: 'blocked', label: 'Blocked', glyph: '⛔', category: 'Status', keywords: ['stuck', 'waiting'] },
  { id: 'warning', label: 'Warning', glyph: '⚠️', category: 'Status', keywords: ['risk', 'careful'] },
]

const iconsById = new Map(wikiIcons.map((icon) => [icon.id, icon]))

export function resolveWikiIcon(value?: string) {
  const clean = value?.trim().toLowerCase()
  if (!clean) return iconsById.get('page')!
  return iconsById.get(clean)
}

export function isRawEmoji(value?: string) {
  return Boolean(value?.trim() && !/^[a-z0-9_-]+$/i.test(value.trim()))
}

export function renderIconShortcodes(content: string) {
  return content.replace(
    /(`{3,}[\s\S]*?`{3,}|`[^`\n]+`)|:([a-z0-9_-]+):/gi,
    (match, codeBlock: string | undefined, id: string | undefined) => {
      if (codeBlock) return match
      return resolveWikiIcon(id!)?.glyph ?? match
    },
  )
}
