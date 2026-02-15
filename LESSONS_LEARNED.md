# Ruin — Lessons Learned & Prompt Preamble

Reference this document when creating Claude Code prompts for the Ruin project. These are hard-won patterns discovered during implementation. Violating them will cause debugging sessions.

Include relevant sections based on the task:
- Server changes: Sections 1, 2, 3, 5, 7, 8, 12
- Client changes: Sections 6, 10
- Config or path resolution changes: Sections 3, 4, 5
- Docker or deployment: Sections 9, 11
- New Colyseus features: Sections 7, 8, 12
- Adding new dependencies: Sections 1, 2

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

---

## Quick Reference: Current Project State

When writing prompts, include the current state so the agent knows what exists:

### Packages
- `@ruin/shared` — Types (IPlayer, IWorldSave, INpc, messages) and constants (TICK_RATE=20, MAX_PARTY_SIZE=8, TILE_SIZE=16)
- `@ruin/server` — Colyseus game server + Express auth API + PostgreSQL persistence
- `@ruin/client` — Phaser 3 browser client with Vite

### Server Entry Points
- `createApp(pool)` — Returns configured Express app (used by tests, no Colyseus)
- `createGameServer(app)` — Wraps Express in HTTP server, creates Colyseus Server, returns it
- Standalone startup: calls both, then `gameServer.listen(port)`

### Database
- Migration runner with `schema_migrations` tracking table
- Tables: `accounts`, `world_saves`, `characters`, `npcs`, `game_events`
- Auth: bcrypt + JWT (register/login at `/auth`)

### Colyseus
- `WorldRoom` registered as "world"
- `WorldState` schema with `MapSchema<PlayerState>`
- `PlayerState`: sessionId, name, x, y
- JWT verification in `onJoin`, close code 4001 on failure
- Session-scoped Pino child loggers

### Tests
- 11 passing: 7 auth integration + 4 schema unit
- Test DB: `ruin_test` (separate from dev DB `ruin`)
- Tests use `createApp(pool)` directly (no Colyseus)

### Configuration
- Full ESM, Node 20, TypeScript strict
- pnpm workspaces, scoped packages
- Docker Compose: Postgres 16 + optional server container