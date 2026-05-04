import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const themeKey = 'wikindie:theme'

function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(themeKey, theme)
    } catch {
      // Theme still applies for the current page even if storage is blocked.
    }
  }, [theme])

  const toggle = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggle }
}
