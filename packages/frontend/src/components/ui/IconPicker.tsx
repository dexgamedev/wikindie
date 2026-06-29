import { useEffect, useRef } from 'react'

// Reuses emoji-mart's standard native emoji set (the same pool BlockNote's editor
// emoji picker uses) so we don't maintain our own list. Picker is a framework
// agnostic custom element; we mount it manually to avoid the @emoji-mart/react
// wrapper, which only peers React <=18. emoji-mart and its dataset are imported
// dynamically so they only load when a picker is actually opened.
export function IconPicker({ onSelect }: { onSelect: (glyph: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let node: HTMLElement | null = null
    let cancelled = false

    void Promise.all([import('emoji-mart'), import('@emoji-mart/data')]).then(([{ Picker }, data]) => {
      if (cancelled || !container) return
      const picker = new Picker({
        data: data.default,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        previewPosition: 'none',
        navPosition: 'top',
        // Fill the wide meta container and lay emojis out horizontally instead of
        // rendering as a fixed narrow, tall strip.
        dynamicWidth: true,
        maxFrequentRows: 1,
        onEmojiSelect: (emoji: { native?: string }) => {
          if (emoji?.native) onSelectRef.current(emoji.native)
        },
      })
      node = picker as unknown as HTMLElement
      container.appendChild(node)
    })

    return () => {
      cancelled = true
      if (node && node.parentNode === container) container.removeChild(node)
    }
  }, [])

  return <div ref={containerRef} className="w-full [&>em-emoji-picker]:w-full" />
}
