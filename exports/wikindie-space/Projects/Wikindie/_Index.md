---
title: 'Project: Wikindie'
icon: project
---
# Project: Wikindie

**Wikindie** is a self-hosted, agent-native wiki built for developers. All content lives as plain Markdown files on disk — no database, no external services required.

## Overview

- **Version:** 0.2.3
- **Status:** Active development
- **Stack:** Node.js 22 · Express 5 · React 19 · TipTap 3 · Tailwind 4
- **Deployment:** Docker / self-hosted
- **License:** MIT

## Key Features

- **Filesystem storage** — every page is a `.md` file under `SPACE_DIR`; no database
- **Kanban boards** — `##` columns, `- Card` bullets; stored and parsed as plain Markdown
- **Sections** — modular sub-documents inlined at read time via frontmatter references
- **Live updates** — chokidar watches `SPACE_DIR`, pushes events over WebSocket to all clients
- **Multi-user** — JWT sessions + API keys, role-based access (admin / write / read / delete)
- **AI chat** — pluggable providers: Anthropic, OpenAI, Ollama, or local Qwen2.5 via node-llama-cpp
- **REST API** — full CRUD for pages, kanban, sections; Bearer token auth (JWT or `wk_` API keys)

## Architecture

```
packages/
  backend/   Express 5 + TypeScript (NodeNext), filesystem storage
  frontend/  React 19 + Vite 7 + Tailwind 4, TipTap editor
scripts/     Build + copy helpers
```

Data lives at `SPACE_DIR` (default `packages/backend/space`).
Docker Compose mounts root `./space` to `/space`.

## Roadmap

See the [Board](Projects/Wikindie/Board) for ongoing tasks and priorities.
