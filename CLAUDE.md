# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- npm workspaces with the root `package-lock.json`; do not switch to pnpm/yarn. Node.js 22+.
- `npm run dev` (root) runs backend + frontend concurrently. Frontend at `http://localhost:5173`, backend at `http://localhost:3000` with Vite proxying `/api` and `/ws`.
- Per-workspace: `npm run dev -w packages/backend`, `npm run dev -w packages/frontend`, `npm run typecheck -w packages/<pkg>`.
- Verification is `npm run typecheck` + `npm run build`. There is **no test, lint, or formatter** configured.
- `npm run build` builds backend, builds frontend, then `scripts/copy-frontend.mjs` copies `packages/frontend/dist` to `packages/backend/public`. `npm run start` requires that build output to exist.

## Runtime & environment

- Node does **not** auto-load `.env`. Pass `WIKINDIE_USER`, `JWT_SECRET`, `SPACE_DIR`, `PORT` through the shell, Docker, or host env.
- Auth falls back to `dev:dev` only when `WIKINDIE_USER` is unset and `NODE_ENV !== 'production'`.
- `SPACE_DIR` resolves from the backend process cwd. Root `npm run dev` starts the backend in `packages/backend`, so local data lives at `packages/backend/space`. Docker Compose mounts root `./space` to `/space`.

## Architecture

### Storage model (filesystem, no DB)

- All workspace data is Markdown under `SPACE_DIR`. There is no database.
- A page is either a **leaf** `Page.md` or an **index** `Page/_Index.md` (the latter when it has children). Creating a child page may convert a leaf into an `_Index.md` container — see `ensurePageContainer` in `packages/backend/src/lib/files.ts`.
- All path handling must go through `safePath`, `normalizePagePath`, `normalizeFilePath`, `pageToLeafPath`, `pageToIndexPath`, `resolvePageStoragePath` in `packages/backend/src/lib/files.ts`. `safePath` enforces traversal protection — never bypass it.
- **Frontmatter is the schema.** It carries `title`, `icon`, `sections` (array of `{title, path}`), and `kanban: true` for boards. Sections are separate Markdown files (typically under `_sections/` inside the page folder) referenced from frontmatter — `readPage` loads and inlines them.
- **Kanban boards are Markdown.** `##` headings are columns and `- [ ] ` items are cards. `kanbanColumns` frontmatter stores stable column IDs and workflow statuses. Completion is represented by moving cards into a column with `status: done`, not by per-card checkboxes. Parser/serializer is `packages/backend/src/lib/kanban.ts`. Saving a board always sets `kanban: true` and refreshes `kanbanColumns` in frontmatter.

### Backend (Express 5)

- Entry: `packages/backend/src/index.ts` wires CORS, JSON parsing, `authRouter` (public), `filesRouter` (under `requireAuth`), static frontend serving from `../public`, and a WebSocket upgrade handler at `/ws` that verifies a JWT from the `?token=` query param.
- Routes use **Express 5 wildcard syntax** like `/page/*path` — `req.params.path` may be an array, normalize with `joinedPath = (v) => Array.isArray(v) ? v.join('/') : String(v ?? '')` (see `routes/files.ts`).
- The catch-all is `app.get('*splat', ...)` — also Express 5 syntax.
- `chokidar` watches `SPACE_DIR` and broadcasts `tree:changed` and `file:changed` (with relative `.md` path) over the WS to all connected clients (`lib/watcher.ts`).
- Backend TS uses `module: NodeNext`. **Relative imports must use `.js` extensions** (e.g., `import { foo } from './lib/files.js'`) even though the source is `.ts`.

### Frontend (React 19 + Vite 7 + Tailwind 4)

- Entry: `packages/frontend/src/App.tsx`. Auth-gated routes redirect to `/login`; root redirects to `/page/Workspace`.
- API client: `src/lib/api.ts` uses same-origin `/api/*` paths (Vite proxies in dev, backend serves directly in prod). All requests inject `Authorization: Bearer <token>`; a `401` triggers `logout()`.
- State: Zustand. `useAuthStore` persists `token`/`username` in `localStorage` under keys `wikindie:token` and `wikindie:username`. `useFilesStore` holds the page tree.
- WebSocket file events arrive as Markdown paths like `Page.md` or `Page/_Index.md`; refresh logic in `pages/PageView.tsx` matches against those exact forms.
- Editor stack: TipTap 3 with `tiptap-markdown` for round-tripping; `react-markdown` + `remark-gfm` for rendering; `lowlight` for code highlighting.
- Page icons are friendly colored IDs from `src/lib/icons.ts` (e.g., `project`, `idea`, `devlog`) — **not** Lucide/icon-library names. Markdown supports matching shortcodes like `:idea:`.

### Build pipeline

`tsc -b && vite build` (frontend) → `tsc` (backend) → `scripts/copy-frontend.mjs` copies `packages/frontend/dist` → `packages/backend/public`. The Dockerfile reproduces this and serves everything from the backend on port 3000.
