import express, { Router } from 'express'
import { AppError } from '../lib/errors.js'
import { attachmentUploadLimitBytes, readAttachment, writeAttachment } from '../lib/attachments.js'
import { requirePermission } from '../middleware/permissions.js'

export const attachmentsRouter = Router()

const paramValue = (value: unknown) => (Array.isArray(value) ? value[0] : String(value ?? ''))

// Only render these in the browser. Everything else (HTML, SVG, XML, JS, ...)
// is forced to download so it can't execute as a document on the app origin.
const SAFE_INLINE_TYPE = /^(image\/(?!svg\b|svg\+xml)|video\/|audio\/|application\/pdf\b)/i

function contentDisposition(filename: string, disposition: 'inline' | 'attachment') {
  const fallback = filename.replace(/["\\\r\n]/g, '_')
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

attachmentsRouter.post('/:pageId', requirePermission('write'), express.raw({ type: '*/*', limit: attachmentUploadLimitBytes }), async (req, res) => {
  if (!Buffer.isBuffer(req.body)) throw new AppError(400, 'Missing attachment body')
  const filename = String(req.query.filename ?? req.header('x-wikindie-filename') ?? '').trim()
  if (!filename) throw new AppError(400, 'Missing attachment filename')
  const attachment = await writeAttachment(paramValue(req.params.pageId), {
    filename,
    contentType: req.header('x-wikindie-content-type') ?? req.header('content-type') ?? undefined,
    data: req.body,
  })
  res.status(201).json({ attachment })
})

attachmentsRouter.get('/:pageId/:attachmentId/:filename', requirePermission('read'), async (req, res) => {
  const { meta, filePath } = await readAttachment(paramValue(req.params.pageId), paramValue(req.params.attachmentId))
  const disposition = SAFE_INLINE_TYPE.test(meta.contentType) ? 'inline' : 'attachment'
  res.setHeader('Content-Type', meta.contentType)
  res.setHeader('Content-Length', String(meta.size))
  res.setHeader('Content-Disposition', contentDisposition(meta.filename, disposition))
  // Defense-in-depth: neutralize any active content (e.g. a directly-loaded SVG/HTML) served from our origin.
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
  // Attachments are immutable: each upload gets a unique att_ id, so content never changes under a URL.
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
  res.sendFile(filePath, { dotfiles: 'allow' })
})
