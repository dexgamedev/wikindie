# Wikindie

One self-hosted container for the indie dev who does not want five different apps to run a small project.

Wikindie is a no-database wiki and lightweight kanban board for solo builders, tiny teams, and small organizations. Keep your product notes, specs, meeting notes, personal backlog, and delivery board in one place, stored as plain Markdown files you can back up, edit, diff, and move around like normal files.

It is also meant to be agent-native: a wiki that humans can use directly, but that AI agents can manage through a detailed API. The goal is for an agent to create pages, update specs, reorganize knowledge, maintain boards, and keep a small project workspace coherent without needing browser automation or database access.

If you are tired of juggling a wiki, a task board, a docs tool, and a pile of private notes just to keep one indie project organized, Wikindie is meant to be the boring, self-hostable alternative.

## Why Wikindie

- One container: deploy the app as a single Docker service.
- No database: your workspace is a folder of Markdown files.
- Self-hostable: keep your notes and plans on infrastructure you control.
- Wiki plus kanban: write long-form docs and manage simple boards in the same app.
- Agent-native: expose workspace actions through an API built for automated management.
- Small-team friendly: built for indie devs, solo operators, and lightweight organizations.
- Portable by default: copy, sync, back up, or inspect the workspace without exporting anything.

## Features

- Markdown pages stored directly on disk.
- Nested page tree with drag-and-drop moves.
- Page metadata through frontmatter, including title and icon.
- Modular page sections stored as separate Markdown files.
- Kanban boards serialized as Markdown task lists.
- HTTP API for managing the tree, pages, sections, metadata, and kanban boards.
- Token-based login with WebSocket refresh events for file changes.
- Docker image that serves the built frontend from the backend.

## Stack

- React 19, Vite 7, Tailwind CSS 4, Zustand, React Router.
- Express 5, TypeScript, `ws`, `chokidar`, `gray-matter`.
- npm workspaces for `packages/frontend` and `packages/backend`.

## Quick Start

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:3000` and Vite proxies API and WebSocket traffic during development.

Local development defaults to `dev:dev` unless `WIKINDIE_USER` is set.

## Workspace Data

Wikindie stores your workspace as Markdown files on disk. For local development, the default workspace is `packages/backend/space` when using the npm workspace scripts.

Your workspace data is not stored in a database. Back up the directory configured by `SPACE_DIR` like any other important project folder.

Wikindie also stores app-managed auth metadata inside the workspace directory under `.wikindie/`:

```text
<SPACE_DIR>/.wikindie/users.json
<SPACE_DIR>/.wikindie/apikeys.json
```

Keep this hidden `.wikindie` directory with the rest of your workspace data. If it is not persisted, users and API keys created through the app will not survive redeploys.

Create the workspace directory before first use if it does not exist yet:

PowerShell:

```powershell
New-Item -ItemType Directory -Force packages/backend/space
npm run dev
```

macOS/Linux:

```bash
mkdir -p packages/backend/space
npm run dev
```

## Docker

Docker Compose reads environment values from your shell or a root `.env` file. Start from `.env.example` and replace the credentials before running the container.

PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

macOS/Linux:

```bash
cp .env.example .env
docker compose up --build
```

The compose file mounts `./space` into the container as `/space`, so your Docker workspace lives in a root-level `space` directory.

## Production Data Safety

Production deployments must mount `SPACE_DIR` to persistent storage. The container filesystem is disposable and must not be treated as workspace storage.

Common production settings when mounting storage at `/space`:

```bash
NODE_ENV=production
SPACE_DIR=/space
```

If `SPACE_DIR` is not set in the Docker image, Wikindie uses `./space`, which resolves to `/app/space` because the container workdir is `/app`. You can either mount persistent storage at `/app/space` and omit `SPACE_DIR`, or mount persistent storage at another path such as `/space` and set `SPACE_DIR` to match.

For hosted Docker platforms such as CapRover, Coolify, and similar app managers, configure the workspace path as persistent storage before first start. Depending on the platform, this may be called a persistent app directory, volume, storage mount, or directory mount. The path inside the container must match `SPACE_DIR`; if `SPACE_DIR` is unset, use `/app/space`.

Do not change the mounted workspace path after data exists unless you also migrate the files. For example, data stored under a persistent `/space` mount will not appear if the app later starts with `SPACE_DIR=/app/space` or with `SPACE_DIR` unset.

In production, Wikindie starts with an empty workspace when the configured workspace directory is empty. It does not seed placeholder content unless you explicitly opt in. This keeps brand-new installs clean and prevents a bad deploy or missing volume mount from silently replacing your real workspace with starter content.

To seed the optional starter workspace in production, set this for the first start only:

```bash
WIKINDIE_INIT_DEFAULT_SPACE=true
```

Remove that variable after the starter workspace is created. Existing non-empty workspaces are never overwritten by the starter workspace seeding step.

Deployment checklist:

1. Configure persistent storage mounted at your chosen workspace path.
2. Use `/app/space` with no `SPACE_DIR`, or set `SPACE_DIR` to your mounted path such as `/space`.
3. Set `WIKINDIE_USER` and `JWT_SECRET`.
4. Leave `WIKINDIE_INIT_DEFAULT_SPACE` unset for a blank wiki.
5. Set `WIKINDIE_INIT_DEFAULT_SPACE=true` only if you want the starter/demo workspace on first start, then remove it.
6. Back up the mounted workspace directory before changing deployment storage settings or deleting old containers/volumes.

If the app starts with an empty workspace unexpectedly, check the mounted workspace path before creating new pages. If data appears missing after a redeploy, inspect old Docker containers, volumes, and host paths before pruning anything.

Troubleshooting path errors:

1. Check the startup log path, for example `Starting with an empty workspace at /app/space`.
2. Check your platform persistent storage path inside the container.
3. If the persistent path is `/space`, set `SPACE_DIR=/space`.
4. If the persistent path is `/app/space`, leave `SPACE_DIR` unset or set `SPACE_DIR=/app/space`.
5. If you switch between `/space` and `/app/space`, copy the existing Markdown files to the new mounted path before starting the app.

Change `WIKINDIE_USER` and `JWT_SECRET` before exposing the app outside your local machine.

## Environment

Set these variables in your shell, Docker environment, or deployment host:

| Variable | Default in development | Description |
| --- | --- | --- |
| `WIKINDIE_USER` | `dev:dev` | Login credentials in `username:password` format. Required in production. |
| `JWT_SECRET` | Dev-only fallback | Secret used to sign session tokens. Required in production. |
| `SPACE_DIR` | `./space` | Directory containing Markdown workspace files, resolved from the backend process working directory. |
| `WIKINDIE_INIT_DEFAULT_SPACE` | unset | Set to `true` only when you want to seed the starter/demo workspace into an empty `SPACE_DIR`. |
| `PORT` | `3000` | Backend HTTP port. |

`.env.example` documents the expected variables, but the Node app does not automatically load `.env` files. Pass variables through your shell, process manager, Docker, or hosting platform.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run backend and frontend development servers. |
| `npm run build` | Build both packages and copy frontend assets into `packages/backend/public`. |
| `npm run start` | Start the built backend, serving the copied frontend assets. |
| `npm run typecheck` | Type-check backend and frontend workspaces. |

## Project Layout

```text
packages/backend   Express API, filesystem storage, WebSocket watcher
packages/frontend  React application
scripts            Small repository maintenance scripts
```

## Data Model

Pages are Markdown files. Nested pages can be stored as either `Page.md` leaf files or `Page/_Index.md` index files with children. Frontmatter controls display metadata and board behavior.

Sections are declared in page frontmatter and stored as additional Markdown files, usually under `_sections/` inside the page folder.

Kanban boards are Markdown files with `kanban: true` frontmatter. Each `## Heading` becomes a column and task-list items become cards; `kanbanColumns` frontmatter stores stable column IDs and workflow statuses for integrations. Completion is represented by moving cards into a column whose status is `done` rather than checking individual cards.

## Status

This is an early public release. There is no automated test suite yet, so `npm run typecheck` and `npm run build` are the current verification commands.

## License

MIT
