# Phase 2a Status Report — World Persistence & Hosting Model (Persistence Layer)

**Date:** 2026-02-27
**Branch:** master
**Prior test count:** 59 (9 files)
**Final test count:** 80 (9 files → no new files; 2 new `__tests__` files added)

---

## Summary

Phase 2a is complete. All deliverables from the prompt have been implemented: a database-backed world persistence service, REST routes for world CRUD operations, WorldRoom rewrite with async lifecycle and auto-save, client lobby UI, and integration tests covering both the persistence layer and HTTP routes.

Build: **zero TypeScript errors.**
Tests: **80/80 passing.**

---

## Files Created

### `packages/shared/src/constants/world.ts`
Exports `DEFAULT_WORLD_DATA` — the canonical empty-world payload stored in `world_saves.world_data` (JSONB). Shared between server persistence and WorldRoom so neither hardcodes a magic literal.

```typescript
export const DEFAULT_WORLD_DATA: Record<string, unknown> = { mapId: 'town' };
```

### `packages/server/src/persistence/WorldPersistence.ts`
Pure async functions, each accepting a `Pool` parameter for testability. The singleton `pool` is injected at call sites in WorldRoom and routes. Interfaces exported: `WorldSaveRow`, `CharacterRow`, `CharacterSaveData`.

Functions:
- `createWorld(pool, name, ownerId)` — inserts into `world_saves`, returns the new row
- `getWorld(pool, worldId)` — returns `WorldSaveRow | null`
- `listWorldsByOwner(pool, ownerId)` — returns `WorldSaveRow[]`
- `deleteWorld(pool, worldId, ownerId)` — deletes only if owner matches, returns boolean
- `createCharacter(pool, worldId, accountId, name)` — inserts into `characters`
- `getCharacter(pool, worldId, accountId)` — returns `CharacterRow | null`
- `saveAll(pool, worldId, worldData, characters)` — transactional: updates `world_saves.world_data` and each character's position in one BEGIN/COMMIT block

Key implementation note: node-postgres does **not** auto-serialize JS objects to JSONB. All JSONB values are passed as `JSON.stringify(value)`.

### `packages/server/src/world/routes.ts`
Factory function `createWorldRoutes(dbPool: Pool): Router`. Auth middleware is applied at mount time in `index.ts`, not inside this file — consistent with the `createApp(pool)` pattern used throughout.

Routes:
- `POST /worlds` — create world (name from body, accountId from auth token)
- `GET /worlds` — list worlds owned by authenticated account
- `GET /worlds/:id` — get single world (owner-gated)
- `DELETE /worlds/:id` — delete world (owner-gated)

TypeScript note: Express types `req.params[key]` as `string | string[]`. Fixed with explicit `as string` cast: `const worldId = req.params['id'] as string;`

### `packages/client/src/lobby/LobbyUI.ts`
Plain TypeScript class, no Phaser dependency. Constructor: `(container: HTMLElement, onJoinWorld: (worldId: string, characterName: string) => void)`. Calls `NetworkClient.autoRegister()` on init, renders two sections: "Your Worlds" (load or create) and "Join a World" (by ID + character name).

Uses `window.__lobby` exposure pattern for inline `onclick` handlers since the rendered HTML is set via `innerHTML`.

Public methods:
- `getToken(): string`
- `getAccountId(): string`

### `packages/server/__tests__/persistence.test.ts`
13 integration tests. Uses `beforeEach: TRUNCATE ... accounts CASCADE` for full isolation between tests. Direct DB insertion via helper `createTestAccount()`.

Test coverage:
- `createWorld` (success case)
- `getWorld` (found + null)
- `listWorldsByOwner` (owned worlds only)
- `deleteWorld` (success, non-owner rejected, non-existent returns false)
- `createCharacter` (success, duplicate rejected)
- `getCharacter` (found + null)
- `saveAll` (position update, world_data update)

### `packages/server/__tests__/worldRoutes.test.ts`
8 HTTP integration tests using supertest against the full Express app.

Test coverage:
- `POST /worlds` — creates world, returns 201 with id/name/owner_id
- `POST /worlds` — validation error (missing name) returns 400
- `POST /worlds` — unauthenticated request returns 401
- `GET /worlds` — lists worlds for authenticated owner
- `GET /worlds/:id` — returns single world
- `GET /worlds/:id` — non-existent world returns 404
- `DELETE /worlds/:id` — deletes owned world, returns 204
- `DELETE /worlds/:id` — non-owner request returns 404

---

## Files Modified

### `packages/shared/src/index.ts`
Added barrel export for the new constants file:
```typescript
export * from './constants/world.js';
```

### `packages/server/src/index.ts`
Imported `authMiddleware` and `createWorldRoutes`. Mounted world routes at `/worlds` with auth applied at mount time:
```typescript
app.use('/worlds', authMiddleware, createWorldRoutes(dbPool));
```

### `packages/server/src/rooms/schemas/WorldState.ts`
Added `accountId` field to `PlayerState` schema — needed by the Phase 2b hosting model to identify which connected player is the world owner:
```typescript
@type('string') accountId: string = '';
```

### `packages/server/src/rooms/WorldRoom.ts`
Full rewrite. Key changes:

- **`async onCreate`**: loads world from DB via `getWorld(pool, worldId)`. Throws `new Error(...)` if not found (not `this.disconnect()` — no clients exist yet in `onCreate`). Stores `world.owner_id` from DB rather than trusting client-supplied options. Starts 60-second auto-save interval.
- **`async onJoin`**: first-joiner ownership check — if `client.sessionId` is the first player and their `accountId` doesn't match `this.hostAccountId`, calls `client.leave(4002)`. Restores character from DB or creates new one. Sets `player.x`, `player.y`, `player.name`, `player.accountId` before calling `state.players.set()` to avoid sending a partially-initialized patch.
- **`onLeave`**: fire-and-forget save pattern (`void saveAll(...).catch(...)`) — Colyseus does not guarantee async `onLeave` completes before client removal.
- **`private async autoSave()`**: guarded by `this.saving` boolean to prevent overlap between concurrent interval fires and dispose-time save.
- **`async onDispose`**: clears interval, runs final `saveAll` if any players remain.

New instance properties: `accountIdBySession: Map<string, string>`, `characterIdBySession: Map<string, string>`, `autoSaveInterval: ReturnType<typeof setInterval> | null`, `saving: boolean`.

### `packages/client/src/network/client.ts`
- `joinWorld` updated to accept optional `characterName?: string`, forwarded in `joinOrCreate` room options.
- `autoRegister()` now checks `localStorage` first (key: `ruin_credentials`). Tries login with stored credentials; on failure, clears storage and registers a fresh account; stores new credentials on success.
- Added static API helpers: `createWorld(token, name)`, `listWorlds(token)`, `deleteWorld(token, worldId)`.

### `packages/client/index.html`
- Added `#lobby-container` div (visible by default) and `#game-container` div (hidden by default).
- Added CSS: dark background, flexbox-centered lobby layout, monospace font, styled buttons/inputs.
- Removed `overflow: hidden` from body (lobby content needs to scroll).

### `packages/client/src/main.ts`
Changed from immediate Phaser game creation to lobby-first flow:
1. `LobbyUI` is created and attached to `#lobby-container`.
2. On `onJoinWorld(worldId, characterName)`: lobby container hidden, game container shown, `window.__gameParams` set, Phaser game created.

### `packages/client/src/scenes/WorldScene.ts`
- Removed `NetworkClient` import (only the `networkClient` singleton is needed, not the class itself).
- Replaced hardcoded `autoRegister()` + `'dev-world'` with `window.__gameParams` read.

### `LESSONS_LEARNED.md`
Added sections 15–18:
- **15. Sprite interpolation with `setPosition` pitfall** — Phaser's `setPosition` skips tweens in progress
- **16. Persistence service pattern** — pure functions + Pool injection for testability
- **17. Room ownership from DB, not client** — never trust client-supplied `hostAccountId`
- **18. Auto-save overlap protection** — `saving` boolean flag pattern for concurrent save prevention

Updated Quick Reference section with new files, test count, `accountId` on `PlayerState`, auto-save interval, `localStorage` credential persistence, `window.__gameParams` pattern.

### `vitest.config.ts`
Added `fileParallelism: false`. See "Unplanned Changes" below.

---

## New npm Packages Installed

None.

---

## Unplanned Changes

### `vitest.config.ts` — `fileParallelism: false`

**Not specified in the prompt.** Added to resolve integration test race conditions.

**Problem:** vitest runs test files in parallel by default. All three database-touching test files (`auth.test.ts`, `persistence.test.ts`, `worldRoutes.test.ts`) share the same `ruin_test` database. Each uses `beforeEach: TRUNCATE ... accounts CASCADE` for isolation, but parallel execution caused FK constraint violations and unexpected 409/201 responses as truncations from one file deleted rows mid-test in another.

**Fix:** `fileParallelism: false` makes vitest execute test files sequentially. Tests within a single file still run in parallel (default). This is the correct configuration for any project with shared-database integration tests.

**Trade-off:** Slightly slower test runs (8.8s vs ~5s parallel). Acceptable given that integration tests are the minority and the root cause is shared mutable state, not slow tests.

---

## Issues Encountered and Resolutions

### 1. TypeScript error: `req.params['id']` typed as `string | string[]`

**File:** `packages/server/src/world/routes.ts`, lines 84 and 114
**Error:** `Argument of type 'string | string[]' is not assignable to parameter of type 'string'`
**Cause:** Express's TypeScript definitions type `req.params` values as `string | string[]` to cover edge cases.
**Fix:** Explicit `as string` cast: `const worldId = req.params['id'] as string;`

### 2. Integration test failures — parallel database interference (two rounds)

**Round 1:** `worldRoutes.test.ts` registered its test user in `beforeAll`, but `persistence.test.ts`'s `beforeEach` truncation deleted that account mid-test. Fixed by moving worldRoutes registration to `beforeEach`.

**Round 2:** `worldRoutes.test.ts`'s `beforeEach` truncation then deleted accounts during `auth.test.ts` tests running in parallel. Auth tests began failing with unexpected 201s (re-registration succeeded where 409 was expected).

**Final fix:** `fileParallelism: false` in `vitest.config.ts`. Eliminated all race conditions definitively.

---

## Test Results

```
Test Files   9 passed (9)
Tests       80 passed (80)
Duration     8.83s
```

| File | Tests | Status |
|------|-------|--------|
| `packages/server/__tests__/auth.test.ts` | 8 | ✓ |
| `packages/server/__tests__/movement.test.ts` | 10 | ✓ |
| `packages/server/__tests__/persistence.test.ts` | 13 | ✓ NEW |
| `packages/server/__tests__/schema.test.ts` | 4 | ✓ |
| `packages/server/__tests__/worldRoutes.test.ts` | 8 | ✓ NEW |
| `packages/client/__tests__/direction.test.ts` | 11 | ✓ |
| `packages/client/__tests__/Interpolation.test.ts` | 8 | ✓ |
| `packages/shared/__tests__/movement.test.ts` | 16 | ✓ |
| `packages/shared/__tests__/schema.test.ts` | 2 | ✓ |

---

## Build

```
tsc --noEmit: 0 errors
```

---

## Functional Confirmation

The following flows are implemented end-to-end:

1. **Lobby load**: Player lands on lobby screen (not Phaser), authenticates via `autoRegister()` with localStorage persistence, sees their existing worlds.
2. **Create world**: POST `/worlds` inserts into `world_saves`, player is forwarded into the game.
3. **Load world**: GET `/worlds/:id` verifies ownership, player joins existing Colyseus room with their character restored from DB.
4. **Join world**: Player can join another player's world by ID + character name. WorldRoom creates a character record for new joiners.
5. **Auto-save**: WorldRoom saves all player positions to DB every 60 seconds while the room is alive.
6. **Save on leave**: Player position saved fire-and-forget when they disconnect.
7. **Save on dispose**: Final save runs synchronously when the room is destroyed.
8. **Delete world**: DELETE `/worlds/:id` enforces owner-only access.

---

## What Phase 2a Does Not Include

Phase 2b deliverables (room rehydration on host reconnect, guest join/leave flow, graceful shutdown) are deferred to the next sub-phase as designed.

---

## Post-Completion Debug Report

Two bugs were discovered during manual testing after the initial implementation was complete.

### Bug 1 — "Your Worlds" shows JSON parse error: `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

**Symptom:** Error appears under the "Your Worlds" heading immediately on lobby load.

**Root cause:** `NetworkClient.listWorlds()` fetches `GET /worlds` as a relative URL. The Vite dev server (port 3009) proxies `/auth` and `/colyseus` to the Express backend (port 2567) but `/worlds` was never added to the proxy config. Vite's default behavior for unrecognized routes is to serve `index.html` (the SPA fallback), which is HTML — not JSON. Parsing that HTML as JSON produces the "Unexpected token '<'" error.

**Fix:** Added `/worlds` proxy entry to `packages/client/vite.config.ts`.

### Bug 2 — "Create New World" button shows: `Create world failed: 404`

**Symptom:** Clicking "Create New World" shows an error in the UI; browser console shows `Failed to load resource: the server responded with a status of 404`.

**Root cause:** Same as Bug 1 — `NetworkClient.createWorld()` posts to `/worlds` as a relative URL. Without a proxy entry, Vite has no handler for `POST /worlds` and returns 404.

**Fix:** Same fix — adding `/worlds` to the Vite proxy resolves both bugs simultaneously.

### File changed

**`packages/client/vite.config.ts`** — Added `/worlds` proxy block:

```typescript
'/worlds': {
  target: 'http://localhost:2567',
  changeOrigin: true,
},
```

### Why tests didn't catch this

The integration tests (`worldRoutes.test.ts`) use supertest, which calls the Express app directly — bypassing Vite entirely. The missing proxy entry only manifests in the browser dev environment. This class of bug (dev proxy misconfiguration) requires manual browser testing to catch and cannot be covered by server-side integration tests.
