import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootPackage = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: string }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(rootPackage.version ?? '0.0.0'),
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
