---
kanban: true
title: Roadmap
kanbanColumns:
  - id: backlog
    status: backlog
  - id: up-next
    status: custom
  - id: in-progress
    status: in_progress
  - id: done
    status: done
taskIds:
  enabled: true
  prefix: WK
---
## :notes: Backlog
- [WK-1] Full-text search across all pages  #release #medium
- [WK-2] Keyboard shortcut reference panel  #beta #medium
- [WK-5] Page version history  #release #low
- [WK-6] Public read-only sharing links  #release #low
- [WK-7] Page templates  #release #low
- [WK-8] Import from Obsidian / Notion  #release #low
- [WK-9] Comments on pages  #release #low
- [WK-10] Webhook notifications on page changes  #release #low
## :star: Up Next
- [WK-12] File and image attachment support  #beta #high
- [WK-13] MCP  #beta #high
  # AI Agent Integration Plan

  ## Phase 1 — Foundations (in progress / next)
  - Per-board task IDs with frontmatter prefix toggle (e.g. taskIdPrefix: WK), disabled by default.
  - Auto vertical reorder of cards within a column by priority (high → medium → low → none).
  - Stable page IDs in frontmatter (id: pg_xxxx), survive renames; path stays human handle.

  ## Phase 2 — MCP Server
  - Built-in MCP endpoint at /mcp (streamable HTTP transport).
  - Per-user API tokens (separate from web JWT), labeled per client, revocable, with last-used timestamp.
  - "Connect to AI" page in the UI: generates token, shows copy-paste snippets for Claude Code, Claude Desktop, opencode, Cursor.
  - Initial tools: search_pages, get_page, create_page, update_page, move_page, list_tasks, get_task, create_task, update_task, move_card, get_activity.
  - Initial resources: workspace _AGENT.md served as MCP prompt/resource on connect.

  ## Phase 3 — Retrieval & Efficiency
  - Full-text search (SQLite FTS5 or in-memory inverted index).
  - Section-scoped reads (get_page?section=Goals) using existing sections frontmatter.
  - Patch-style writes (replace section / append list item / set frontmatter key) instead of full-file overwrite.
  - Structured task query API mirroring kanban filters (status, priority, assignee, board).

  ## Out of scope (for now)
  - Embeddings / vector search — FTS5 covers personal-wiki needs.
  - Per-agent scratch memory — agents have their own.
  - Backlink graph — defer until FTS proves insufficient.

  ## Success criteria
  - An agent in Claude Code or opencode can answer "what's blocking the Roadmap board?" and "mark WK-13 done" without glue code beyond the one-time MCP config.
  - Renaming a page does not break any agent reference acquired earlier in the session.
- [WK-14] Mermaid diagrams  #beta #high
- [WK-16] Page action bar - Get link  #beta #medium
- [WK-15] Tree drag and drop reorder (handle buttons)  #beta #low
## :code: In Progress
- [WK-31] Public showcasing logic  #beta #high
- [WK-4] Auth hardening and rate limiting  #beta #medium
## :idea: Done
- [WK-17] Detailed tasks  #beta #high
  * Automatic board tasking id

  * Priority automatic task reorder
- [WK-18] Move left side-bar icon to top side  #beta #high
- [WK-11] Renaming pages don't change router page  #beta #high
- [WK-3] Improved board view  #beta #high
  * Task labels + filtering

  * Graph/Kanban view

  * Archive tasks
- [WK-19] Initial public release  #alpha
- [WK-20] Multi-user admin console and RBAC  #alpha
- [WK-21] Kanban card priorities, assignees, and column icons  #beta
- [WK-22] Task panel with board-scope filter and search  #beta
- [WK-23] Mobile responsiveness across editor and kanban  #alpha
- [WK-24] Welcome dashboard with recent pages and Wiki overview  #alpha
- [WK-25] API key authentication (wk_ prefix)  #alpha
- [WK-26] Production deploy safety — blank workspace guard  #alpha
- [WK-27] Version display in sidebar  #alpha
- [WK-28] Notion-style sidebar and UI redesign  #alpha
- [WK-29] Prose editor polish - Blocknote  #alpha
- [WK-30] Dark / light theme system  #alpha
