// Guards the Markdown round trip the editor runs on every save. Run this before
// upgrading BlockNote: 0.57 failed all of these cases and corrupted saved pages.
import assert from 'node:assert/strict'
import { ServerBlockNoteEditor } from '@blocknote/server-util'

const editor = ServerBlockNoteEditor.create()
const save = async (markdown) => editor.blocksToMarkdownLossy(await editor.tryParseMarkdownToBlocks(markdown))

const indented = await save('Intro\n\n    const x = "<Widget>";\n\nAfter\n')
assert.ok(indented.includes('<Widget>'), `indented code lost text:\n${indented}`)

const once = await save('[spec](https://example.com/a(b))\n')
const twice = await save(once)
assert.equal(twice, once, 'link with parentheses changes on repeated saves')

const wrapped = await save('First line\nsecond line\n')
assert.ok(!wrapped.includes('\\'), `wrapped paragraph gained hard breaks:\n${wrapped}`)

const captioned = await editor.blocksToMarkdownLossy([{ type: 'image', props: { url: '/x.png', caption: 'Cap' } }])
assert.ok(!captioned.includes('<figure>'), `captioned image saved as HTML:\n${captioned}`)

console.log('Markdown round trip OK')
process.exit(0)
