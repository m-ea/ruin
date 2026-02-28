# Ruin — Lessons Learned & Prompt Preamble

Reference this document when creating Claude Code prompts for the Ruin project. These are hard-won patterns discovered during implementation. Violating them will cause debugging sessions.

Include relevant sections based on the task:
- Server changes: Sections 1, 2, 3, 5, 7, 8, 12, 13
- Client changes: Sections 6, 10, 14
- Config or path resolution changes: Sections 3, 4, 5
- Docker or deployment: Sections 9, 11
- New Colyseus features: Sections 7, 8, 12, 13, 14
- Adding new dependencies: Sections 1, 2
- New schema classes: Section 13

For major prompts or debugging sessions, include the full Quick Reference section at the end.

---

## 1. ESM + pnpm Strict Resolution

pnpm does not hoist transitive dependencies. In ESM mode, you CANNOT import a package unless it is explicitly listed in the consuming package's `package.json`.

**Rule:** Every package that appears in an `import` statement must be a direct dependency. If you need `@colyseus/core`, `@colyseus/ws-transport`, and `@colyseus/schema`, all three must be in `dependencies` — even if `colyseus` meta-package depends on them transitively.

**Rule:** When adding a new library, enumerate ALL sub-packages that will be imported and add each as a direct dependency.

## 2. Dependency Placement (Root vs Package)

Tools used by root-level scripts must be installed at the workspace root. Tools used only within a specific package belong in that package.

| Dependency | Location | Install Command |
|---|---|---|
| tsx | Root devDependencies | `pnpm add -D -w tsx` |
| concurrently | Root devDependencies | `pnpm add -D -w concurrently` |
| vitest | Root devDependencies | `pnpm add -D -w vitest` |
| colyseus, @colyseus/* | Server dependencies | `pnpm -F @ruin/server add ...` |
| phaser, colyseus.js | Client dependencies | `pnpm -F @ruin/client add ...` |

**Rule:** If a root `package.json` script references a binary (tsx, vitest, concurrently), that package must be in root devDependencies.

## 3. ESM Main Module Detection

String comparison between `import.meta.url` and `process.argv[1]` fails due to URL encoding differences (spaces become `%20`, drive letters get extra slashes on Windows, etc.).

**Use this exact pattern:**
```typescript
import { fileURLToPath } from 'node:url';
import { normalize } from 'node:path';

const currentFile = normalize(fileURLToPath(import.meta.url));
const mainFile = process.argv[1] ? normalize(process.argv[1]) : '';
const isMainModule = currentFile === mainFile;

if (isMainModule) {
  // startup code
}
```

**Rule:** Never compare `import.meta.url` strings directly. Always normalize through `fileURLToPath` + `normalize`.

## 4. Project Root Resolution

Do NOT resolve the project root by counting `../` hops from a source file. This breaks when files move or the directory structure changes.

**Use this pattern instead:**
```typescript
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    const pkgPath = resolve(dir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name === 'ruin') return dir;
    }
    dir = dirname(dir);
  }
  throw new Error('Could not find project root (package.json with name "ruin")');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = findProjectRoot(__dirname);
```

**Rule:** Any code that needs the project root (e.g., loading `.env`, resolving migration files) must use a root-finding walk, not relative path counting.

## 5. .env Loading

The config module should load `.env` from the project root found via the pattern above:
```typescript
import dotenv from 'dotenv';
dotenv.config({ path: resolve(PROJECT_ROOT, '.env') });
```

**Rule:** Always use an absolute path derived from the project root. Never rely on `dotenv`'s default CWD-based resolution — it breaks when scripts are invoked from different directories.

## 6. Network Binding for Dev Servers

Vite may bind only to IPv6 `[::1]` by default, causing `ERR_CONNECTION_REFUSED` when browsers try IPv4 `127.0.0.1`.

**Rule:** All Vite configs must include:
```typescript
server: {
  host: '0.0.0.0', // Listen on all interfaces (IPv4 and IPv6)
  port: 3000,
}
```

## 7. Colyseus Server Setup

When using `@colyseus/core` directly (not the `colyseus` meta-package), no default WebSocket transport is configured.

**Required pattern:**
```typescript
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import http from 'node:http';

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});
```

**Rule:** Always configure transport explicitly. Always create `http.Server` from the Express app — do not pass Express directly.

**Rule:** Only `gameServer.listen(port)` should be called. Never call `app.listen()` or `httpServer.listen()` separately — doing so creates a second HTTP server without WebSocket support, and Colyseus connections will fail silently.

## 8. TypeScript Decorators for Colyseus Schemas

Colyseus `@colyseus/schema` uses decorators. Without these tsconfig options, the build fails with cryptic "Unable to resolve signature of property decorator" errors.

**Required in server tsconfig.json:**
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## 9. bcrypt on pnpm

pnpm's strict build script policy blocks bcrypt's native compilation by default.

**Rule:** After `pnpm install`, always run `pnpm rebuild bcrypt`. In Dockerfiles, include:
```dockerfile
RUN apk add --no-cache python3 make g++
RUN pnpm install --frozen-lockfile
RUN pnpm rebuild bcrypt
```

If bcrypt continues to cause friction, the fallback is `bcryptjs` (pure JS, drop-in API replacement, slightly slower).

## 10. Import Extensions by Package

The server and client use different module resolution strategies. Do not mix them.

| Package | Module Resolution | Import Style | Example |
|---|---|---|---|
| @ruin/server | NodeNext (ESM) | `.js` extensions required | `import { config } from './config/index.js'` |
| @ruin/client | bundler (Vite) | Extensionless | `import { BootScene } from './scenes/BootScene'` |
| @ruin/shared | Consumed by both | Built to dist/, resolution depends on consumer | N/A |

**Rule:** Never use `.js` extensions in client code. Always use `.js` extensions in server code.

## 11. Docker Port Conflicts

The default PostgreSQL port 5432 may conflict with local PostgreSQL installations (especially on Windows).

**Default configuration uses 5432.** If there's a conflict, remap in docker-compose.yml:
```yaml
ports:
  - "5433:5432"
```

And update DATABASE_URL accordingly. The README documents this.

## 12. Colyseus Dependencies (Complete List)

When working with Colyseus in pnpm + ESM, these are the packages that must be direct dependencies of @ruin/server:
```json
{
  "@colyseus/core": "^0.15.x",
  "@colyseus/monitor": "^0.15.x",
  "@colyseus/schema": "^2.x",
  "@colyseus/ws-transport": "^0.15.x"
}
```

Do NOT rely on the `colyseus` meta-package to provide these transitively. pnpm's strict ESM resolution requires all imported packages as direct dependencies — transitive imports will fail with ERR_MODULE_NOT_FOUND at runtime.

## 13. Colyseus Schema + TypeScript ES2022 Class Fields

When TypeScript's `target` is `ES2022` or later, `useDefineForClassFields` defaults to `true`. This causes class field initializers to use `Object.defineProperty` semantics, which **silently breaks `@colyseus/schema` decorators**.

The `@type()` decorator installs getter/setter accessors on the class prototype to track changes via the ChangeTree. Native ES2022 class fields overwrite these accessors with plain value properties. Result: state sync produces zero bytes, no patches are ever sent, and the client receives empty state. There are NO runtime errors and NO TypeScript errors — the failure is completely silent.

**Required in server tsconfig.json:**
```json
{
  "compilerOptions": {
    "useDefineForClassFields": false
  }
}
```

**Rule:** Any tsconfig that compiles Colyseus schema classes MUST set `useDefineForClassFields: false`. This applies to the server package. Verify this whenever changing TypeScript target or creating new packages that define schema classes.

## 14. Colyseus Client Schema Typing

The Colyseus.js client SDK (`colyseus.js`) returns dynamically-typed schema proxies in callbacks like `room.state.players.onAdd()`. There is no static TypeScript type for server-defined schemas on the client side without a Colyseus schema codegen step.

**Rule:** `any` type is acceptable for Colyseus client schema proxy parameters in `onAdd`, `onRemove`, and `onChange` callbacks. This is the only permitted use of `any` in the codebase. Add a comment at each usage explaining why.

## 15. Decouple Sprite Position from Game State

Client-side prediction updates tile coordinates at 20Hz (one tile per tick). If sprite positions are set directly from these coordinates, movement appears jerky. Always drive sprite positions through an interpolation layer. Both local and remote players use the same interpolation class.

**Rule:** When creating an interpolation instance, immediately set the sprite position from `getPosition()` to eliminate one-frame mismatches on spawn.

**Rule:** Keep prediction on the 20Hz client tick. Do NOT move prediction to 60fps update(). This preserves deterministic alignment with the server tick rate.

## 16. Persistence Service Pattern

Database operations for game state use standalone async functions that take a `Pool` parameter, NOT the singleton pool. This allows tests to pass their own pool connected to `ruin_test`. The singleton pool is used by route handlers and room code at runtime.

**Rule:** Always `JSON.stringify()` objects before passing to JSONB parameterized queries. node-postgres does not auto-serialize JavaScript objects for JSONB columns — it calls `.toString()`, yielding `[object Object]`.

## 17. Room Ownership from Database, Not Client

Never trust client-supplied hostAccountId. Load the world from DB in onCreate, extract owner_id, and validate the first joiner's accountId against it. This prevents malicious clients from claiming ownership of worlds they don't own.

**Rule:** In async onCreate, use `throw new Error(...)` to reject room creation — do NOT use `this.disconnect()` because no clients are connected yet. Throwing causes the client's `joinOrCreate` promise to reject.

## 18. Auto-Save Overlap Protection

Auto-save runs on a 60-second interval. onDispose also triggers a final save. Use a `saving` boolean flag to prevent concurrent saves. Clear the auto-save interval before the dispose save.

**Rule:** onLeave should fire-and-forget its save (`void save().catch(...)`) rather than awaiting — Colyseus does not guarantee async onLeave blocks the removal lifecycle.

## 19. Vite Proxy for New Route Prefixes

Every new Express route prefix (e.g., `/worlds`) must be added to `packages/client/vite.config.ts` proxy config. Without this, Vite's dev server serves `index.html` for unknown routes. The symptom is `Unexpected token '<'` errors when the client tries to parse HTML as JSON.

**Rule:** When adding a server route at a new path prefix, immediately add a matching proxy entry. This is not caught by integration tests (supertest bypasses Vite).

## 20. Idle Timeout Pattern

Track `lastInputTime` per player in a `Map<sessionId, number>`. Reset on any well-formed input from a valid player (after shape validation, before stale rejection) — idle timeout measures engagement, not sync health. Check on a 30-second interval. Warn at 14 minutes, kick at 15 minutes.

**Rule:** Idle timing is approximate (±30 seconds) due to the check interval granularity. Warning may appear between 14:00–14:30, kick between 15:00–15:30.

**Rule:** Send the kick message immediately before `client.leave()` — WebSocket flushes queued frames before close. No `setTimeout` needed.

**Rule:** Clean up `lastInputTime` and `idleWarned` entries in `onLeave` to prevent memory leaks.

## 21. Close Code Registry

Ruin uses custom Colyseus close codes (4000–4999 range):

| Code | Meaning |
|------|---------|
| 4001 | Authentication failed (invalid JWT) |
| 4002 | Not the world owner (first-joiner check) |
| 4005 | Idle timeout |

## 22. Hosting Model — Minecraft Realms Approach

The host is the owner of the world save (determined from DB, never from client). Any authenticated player can keep the room alive — host presence is not required. Room disposes when the last player leaves (default Colyseus `autoDispose`). Host identity is tracked (`hostSessionId`) for future admin features (kick player, close world, whitelist) but has no gameplay effect in Phase 2.

---

## Quick Reference: Current Project State

When writing prompts, include the current state so the agent knows what exists:

### Packages
- `@ruin/shared` — Direction enum, GameMap/TileType, processPlayerInput(), TOWN_MAP, TICK_RATE=20, TILE_SIZE=16, MessageType (INPUT/IDLE_WARNING/IDLE_KICK), InputMessage, IdleWarningMessage, IdleKickMessage
- `@ruin/server` — Colyseus game server + Express auth API + PostgreSQL persistence
- `@ruin/client` — Phaser 3 browser client with Vite (port 3009)

### Server Entry Points
- `createApp(pool)` — Returns configured Express app (used by tests, no Colyseus)
- `createGameServer(app)` — Wraps Express in HTTP server, creates Colyseus Server, returns it
- Standalone startup: calls both, then `gameServer.listen(2567)`

### Database
- Migration runner with `schema_migrations` tracking table
- Tables: `accounts`, `world_saves`, `characters`, `npcs`, `game_events`
- Auth: bcrypt + JWT (register/login at `/auth`)

### Colyseus
- `WorldRoom` registered as "world"
- `WorldState` schema with `MapSchema<PlayerState>`
- `PlayerState`: sessionId, name, accountId, x, y, lastProcessedSequenceNumber
- JWT verification in `onJoin`, close codes: 4001 (auth fail), 4002 (ownership fail), 4005 (idle timeout)
- 20Hz tick loop via `setSimulationInterval`; one queued input processed per player per tick
- Session-scoped Pino child loggers
- Auto-save every 60 seconds; final save on dispose
- World ownership loaded from DB in onCreate (never trusted from client)
- `hostSessionId` tracks currently connected host session (null when host offline)
- Idle timeout: warn at 14min, kick at 15min; checked every 30s; reset on any valid input

### Client
- `LobbyUI` — Pre-game DOM lobby: create/load/join worlds, credential persistence
- `BootScene` — Generates tile textures (ground, wall, water), transitions to WorldScene
- `WorldScene` — Renders TOWN_MAP, reads `window.__gameParams` from lobby, connects to world room; handles idle warning overlay, idle kick overlay, disconnect overlay (returns to lobby after 3s via `window.location.reload()`)
- `InputManager` — Layout-independent key capture via `KeyboardEvent.code`, last-pressed-wins
- `PredictionBuffer` — Client-side prediction with server reconciliation on `lastProcessedSequenceNumber`
- `NetworkClient` — `joinWorld(token, worldSaveId, characterName?)`, `sendInput()`, static `autoRegister()` (localStorage), static `createWorld()`, `listWorlds()`, `deleteWorld()`
- `RemotePlayerInterpolation` — Linear lerp for both local and remote player sprites at 60fps

### Persistence
- `WorldPersistence.ts` — Pure async functions: createWorld, getWorld, listWorldsByOwner, deleteWorld, createCharacter, getCharacter, saveAll
- World routes: POST/GET/DELETE /worlds (auth middleware applied at mount time in index.ts)
- `DEFAULT_WORLD_DATA` exported from `@ruin/shared`

### Tests
- 91+ passing: 8 auth + 4 schema + 10 movement + 13 persistence + 8 worldRoutes + 11 direction + 8 Interpolation + 16 movement(shared) + 2 schema(shared) + 11 idletimeout
- Test DB: `ruin_test` (separate from dev DB `ruin`)
- Tests use `createApp(pool)` directly (no Colyseus)
- Persistence tests use beforeEach truncation for isolation
- `fileParallelism: false` in vitest.config.ts — all DB tests share `ruin_test`

### Configuration
- Full ESM, Node 20, TypeScript strict
- pnpm workspaces, scoped packages
- Docker Compose: Postgres 16 + optional server container
- Server tsconfig: `experimentalDecorators`, `emitDecoratorMetadata`, `useDefineForClassFields: false`