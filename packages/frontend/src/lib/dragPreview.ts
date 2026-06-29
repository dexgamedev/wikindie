export function setDragPreview(dataTransfer: DataTransfer, action: string, title: string) {
  const preview = document.createElement('div')
  preview.textContent = `${action}: ${title}`
  preview.style.position = 'fixed'
  preview.style.top = '-1000px'
  preview.style.left = '-1000px'
  preview.style.maxWidth = '260px'
  preview.style.overflow = 'hidden'
  preview.style.textOverflow = 'ellipsis'
  preview.style.whiteSpace = 'nowrap'
  preview.style.border = '1px solid var(--color-control-border)'
  preview.style.borderRadius = '10px'
  preview.style.background = 'var(--color-panel)'
  preview.style.boxShadow = '0 12px 30px var(--color-shadow-heavy)'
  preview.style.color = 'var(--color-text)'
  preview.style.font = '600 13px Inter, system-ui, sans-serif'
  preview.style.padding = '8px 11px'
  preview.style.pointerEvents = 'none'
  preview.style.zIndex = '9999'
  document.body.appendChild(preview)
  dataTransfer.setDragImage(preview, 16, 16)
  window.setTimeout(() => preview.remove(), 0)
}
