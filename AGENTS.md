# Agent Notes

## Commands
- Use npm workspaces with the root `package-lock.json`; do not switch to pnpm/yarn.
- Requires Node.js 22+. Install with `npm install` from the repo root.
- Dev server: `npm run dev` starts backend and frontend. Frontend is `http://localhost:5173`; backend is `http://localhost:3000`.
- Focused package commands: `npm run dev -w packages/backend`, `npm run dev -w packages/frontend`, `npm run typecheck -w packages/backend`, `npm run typecheck -w packages/frontend`.
- Verification today is `npm run typecheck` and `npm run build`; there is no test, lint, or formatter script/config in this repo.
- `npm run build` builds backend, builds frontend, then copies `packages/frontend/dist` to `packages/backend/public`; `npm run start` only works after that build output exists.

## Runtime And Env
- The app does not auto-load `.env` in Node. Pass `WIKINDIE_USER`, `JWT_SECRET`, `SPACE_DIR`, and `PORT` through the shell, Docker, or host environment.
- Local auth defaults to `dev:dev` only when `WIKINDIE_USER` is unset and `NODE_ENV` is not production.
- `SPACE_DIR` is resolved from the backend process cwd. Root workspace scripts run the backend from `packages/backend`, so local data defaults to `packages/backend/space`; Docker Compose mounts root `./space` to `/space`.
- Vite proxies `/api` and `/ws` to the backend in development; frontend API calls intentionally use same-origin paths.

## Architecture
- `packages/backend/src/index.ts` wires Express 5, auth, protected file routes, static frontend serving, and authenticated WebSocket upgrades at `/ws`.
- Backend storage is filesystem Markdown under `SPACE_DIR`; there is no database. Keep path handling through `safePath`, `normalizePagePath`, and related helpers in `packages/backend/src/lib/files.ts`.
- Pages can be leaf files (`Page.md`) or index pages with children (`Page/_Index.md`). Creating a child page may convert a leaf page into an `_Index.md` container.
- Page frontmatter controls display metadata (`title`, `icon`), sections (`sections` array), and board mode (`kanban: true`). Sections are separate Markdown files, usually below `_sections/`, and are referenced from frontmatter.
- Kanban boards are Markdown: `##` headings are columns and task-list items are cards. The parser/serializer is in `packages/backend/src/lib/kanban.ts`.
- WebSocket file events send Markdown paths like `Page.md` or `Page/_Index.md`; frontend page refresh logic matches those paths in `packages/frontend/src/pages/PageView.tsx`.

## Code Quirks
- Backend TypeScript uses `moduleResolution: NodeNext`; keep relative TS imports using `.js` extensions.
- Express routes use Express 5 wildcard syntax such as `/page/*path`; `req.params.path` may be an array and routes normalize it with `joinedPath`.
- Frontend auth state is persisted in `localStorage` keys `wikindie:token` and `wikindie:username` via Zustand.
- Page icons use friendly colored IDs from `packages/frontend/src/lib/icons.ts` (for example `project`, `idea`, `devlog`), not icon-library names. Markdown supports matching shortcodes like `:idea:`.
