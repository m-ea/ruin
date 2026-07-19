<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.

## Development plan
You are continuing work on "Ruin" — a 2D cooperative multiplayer browser-based RPG. The project is divided into phases, with each phase found below. Reference STATUS_REPORT markdown files in this repository to understand what steps have been completed so far. README.md and LESSONS_LEARNED.md contain important context. The development plan for Ruin is as follows:

### Phase 0 — Foundation (done)

Project scaffolding: monorepo structure, build pipeline, linting, test harness
Colyseus server with room lifecycle (create, join, leave, dispose)
Postgres schema: accounts, characters, world_saves
Auth flow (simple — email/password or OAuth, just enough to tie accounts to world saves)
Logging & observability stack (Pino, Sentry, correlation IDs, Colyseus monitor)
Phaser client shell: loads a tilemap, connects to Colyseus, renders a sprite

### Phase 1 — Networked Movement (done)

Server-side movement simulation at fixed tick rate
Client input sending, server validation, state broadcast
Client-side prediction + reconciliation
Client-side interpolation for remote players
Tile-based collision (server-authoritative)
8-player room stress test

### Phase 2 — World Persistence & Hosting Model (done)

World save/load to Postgres (host account linkage)
Room rehydration on host reconnect
Guest join/leave flow
Graceful shutdown + auto-save on host disconnect

### Phase 3 — Core Character Systems

Character stats, body-part health model
Skill system (XP-on-use, leveling curves)
Inventory & equipment
Persistence of character state to Postgres

### Phase 4 — Combat MVP

Basic melee + ranged attack system (real-time, server-authoritative)
Hit detection mapped to body parts
Injury system (wounds, bleeding, broken limbs)
Monster entities with simple AI (aggro, attack, patrol)
Death/KO and respawn logic
Party-size difficulty scaling

### Phase 5 — NPC & World Systems

NPC state machines (schedules, dialogue triggers)
Social relationship graph (opinion values, events that shift them)
Branching dialogue system with skill/reputation checks
Town zone: shops, quest givers, ambient NPCs

### Phase 6 — Crafting & Alchemy

Recipe system (component + tool requirements, skill-gated)
Resource nodes (gathering tied to skills)
Alchemy experimentation mechanic
Crafting stations (shared for coop interaction)

### Phase 7 — MVP Dungeon & Polish

Dungeon zone with encounters, loot, and a boss
Fog of war / exploration reveal
Chat system (proximity + party channels)
Balancing pass using event audit logs
Bug fixing, performance profiling