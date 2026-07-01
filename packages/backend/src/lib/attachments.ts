import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { AppError, notFound } from './errors.js'
import { isPageId, readPageById, safePath } from './files.js'

export interface AttachmentMeta {
  id: string
  pageId: string
  filename: string
  contentType: string
  size: number
  createdAt: string
  url: string
}

const defaultMaxAttachmentBytes = 25 * 1024 * 1024
const attachmentIdPattern = /^att_[a-f0-9]{32}$/

export const attachmentUploadLimitBytes = Math.max(
  1,
  Number(process.env.WIKINDIE_ATTACHMENT_MAX_BYTES ?? defaultMaxAttachmentBytes) || defaultMaxAttachmentBytes,
)

function generateAttachmentId() {
  return `att_${randomUUID().replaceAll('-', '')}`
}

function assertAttachmentId(value: string) {
  if (!attachmentIdPattern.test(value)) throw new AppError(400, 'Invalid attachment id')
}

function safeFilename(value: string) {
  const base = path.basename(value.replaceAll('\\', '/')).trim()
  const cleaned = base
    .replace(/[\x00-\x1f\x7f<>:"/\\|?*]+/g, '_')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return (cleaned || 'attachment').slice(0, 160)
}

function attachmentDir(pageId: string, attachmentId: string) {
  return `.wikindie/attachments/${pageId}/${attachmentId}`
}

function attachmentUrl(pageId: string, attachmentId: string, filename: string) {
  return `/api/attachments/${encodeURIComponent(pageId)}/${encodeURIComponent(attachmentId)}/${encodeURIComponent(filename)}`
}

async function assertPageExists(pageId: string) {
  if (!isPageId(pageId)) throw new AppError(400, 'Invalid page id')
  await readPageById(pageId)
}

export async function writeAttachment(pageId: string, input: { filename: string; contentType?: string; data: Buffer }): Promise<AttachmentMeta> {
  await assertPageExists(pageId)
  if (input.data.length > attachmentUploadLimitBytes) throw new AppError(413, 'Attachment too large')

  const id = generateAttachmentId()
  const filename = safeFilename(input.filename)
  const contentType = String(input.contentType || 'application/octet-stream').split(';')[0].trim() || 'application/octet-stream'
  const dir = attachmentDir(pageId, id)
  const relativeFilePath = `${dir}/${filename}`
  const meta: AttachmentMeta = {
    id,
    pageId,
    filename,
    contentType,
    size: input.data.length,
    createdAt: new Date().toISOString(),
    url: attachmentUrl(pageId, id, filename),
  }

  await fs.mkdir(safePath(dir), { recursive: true })
  await fs.writeFile(safePath(relativeFilePath), input.data)
  await fs.writeFile(safePath(`${dir}/meta.json`), JSON.stringify(meta, null, 2) + '\n', 'utf8')
  return meta
}

export async function readAttachment(pageId: string, attachmentId: string) {
  assertAttachmentId(attachmentId)
  // Don't serve attachments whose owning page has been deleted (throws 404).
  await assertPageExists(pageId)

  const dir = attachmentDir(pageId, attachmentId)
  let meta: AttachmentMeta
  try {
    meta = JSON.parse(await fs.readFile(safePath(`${dir}/meta.json`), 'utf8')) as AttachmentMeta
  } catch {
    throw notFound('Attachment not found')
  }

  if (meta.pageId !== pageId || meta.id !== attachmentId) throw notFound('Attachment not found')
  return { meta, filePath: safePath(`${dir}/${safeFilename(meta.filename)}`) }
}
