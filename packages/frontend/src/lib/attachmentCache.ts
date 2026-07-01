import { api } from './api'

// Shared, session-lived cache of attachment URL -> object URL. Both the editor
// (resolveFileUrl) and the Markdown preview resolve through here, so an image
// is fetched and turned into an object URL once and reused across every mount.
// Attachments are immutable (unique att_ id per upload), so entries never go stale.
const cache = new Map<string, Promise<string>>()

export function resolveAttachmentObjectUrl(url: string): Promise<string> {
  const existing = cache.get(url)
  if (existing) return existing

  const pending = api
    .attachmentBlob(url)
    .then((blob) => URL.createObjectURL(blob))
    .catch((error) => {
      cache.delete(url)
      throw error
    })

  cache.set(url, pending)
  return pending
}
