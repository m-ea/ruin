# Phase 3a1 Execution Prompt — Character Stats & Body-Part Health Data Model

**Overall Progress:** `100%`

## Execution Status

- [x] 🟩 `packages/shared/src/types/character.ts` (Resource/Stats/BodyHealth)
- [x] 🟩 `packages/shared/src/character/stats.ts` (clampResource, createDefaultStats, createDefaultBodyHealth, recalculateBodyPartMaxes)
- [x] 🟩 `packages/shared/src/types/player.ts` (IPlayer updated to use Stats/BodyHealth)
- [x] 🟩 `packages/shared/src/index.ts` (barrel exports, split by type-only vs. runtime-value convention)
- [x] 🟩 `packages/server/src/rooms/schemas/WorldState.ts` (ResourceSchema/StatsSchema/BodyHealthSchema, wired onto PlayerState)
- [x] 🟩 `packages/server/src/rooms/schemas/mappers.ts` (statsToSchema/bodyHealthToSchema/schemaToStats/schemaToBodyHealth)
- [x] 🟩 `packages/server/src/persistence/WorldPersistence.ts` (CharacterRow extended, createCharacter inserts real defaults)
- [x] 🟩 `packages/shared/__tests__/stats.test.ts` (new, 12 tests)
- [x] 🟩 `packages/server/__tests__/schema.test.ts` (extended, 4 → 13 tests)
- [x] 🟩 `packages/server/__tests__/persistence.test.ts` (extended, 13 → 15 tests)
- [x] 🟩 `pnpm build` — zero TypeScript errors (shared, server, client)
- [x] 🟩 Full test suite — 115/115 passing across 11 files
- [x] 🟩 Verified `WorldRoom.ts` untouched, no new migration, no client changes

## Objective

Implement the character stats and body-part health **data model**: shared types and pure logic, Colyseus schema classes, and Postgres persistence. This prompt covers the data layer only.

## Explicitly Out of Scope

- **No HUD or any client rendering.** That is Phase 3a2, a separate prompt.
- **No changes to `WorldRoom.ts`.** Hydrating `PlayerState` from a loaded `CharacterRow` on join, and persisting stats/health on autosave/leave/dispose, is Phase 3d. `WorldRoom` must build and run unmodified after this prompt.
- **No skill system, inventory, or equipment.** Those are Phases 3b/3c.
- **No new DB migration.** The `characters` table already has `stats` and `body_health` JSONB columns (see `packages/server/src/db/migrations/001_initial_schema.sql`), unused since Phase 0. Do not add a migration — just start reading/writing them.

## Locked Design Decisions

| Area | Decision |
|---|---|
| Stats | `health`, `stamina`, `essence` — each a `{ current, max }` pair |
| Stat defaults | All three start at `current: 100, max: 100` |
| Stat bounds | `current` floored at 0, no ceiling |
| Body parts | `head`, `torso`, `leftArm`, `rightArm`, `leftLeg`, `rightLeg` — each `{ current, max }` |
| Body-part defaults | All six start at `current: 100, max: 100` |
| Body-part max ↔ Health max | 1:1 — every body part's `max` always equals the character's `stats.health.max` |
| Body-part current ↔ Health current | Independent — no coupling. Changing Health's `current` must never touch body-part `current` values (that relationship, if any, is Phase 4's injury system) |
| Body-part current on max-shrink | **Explicit rule (not a judgment call):** if the character's max Health decreases, every body part's `max` decreases with it (1:1, per above). If a body part's `current` is now above its new `max`, that body part's `current` is set equal to the new `max`. This is a bounds invariant (current can never exceed max), not a damage event — it is intentionally distinct from the "current ↔ current" independence rule above, which only governs damage/healing scenarios |
| Recalculation | `recalculateBodyPartMaxes` must be fully implemented and unit-tested now, even though **no production code path calls it in this phase** — `createCharacter` only ever calls `createDefaultBodyHealth` (there is no pre-existing max to recalculate from at creation time). It exists now so it's ready the moment Phase 4+ introduces something that changes max Health after creation |
| Schema shape | Nested typed `Schema` subclasses (not `MapSchema<number>`) — matches the existing `PlayerState` convention |
| Reusability | `StatsSchema`/`BodyHealthSchema` must be standalone classes usable by any future entity schema (e.g. NPCs later), not fields hardcoded directly onto `PlayerState` |

## Part 1 — Shared Package (`@ruin/shared`)

### New file: `packages/shared/src/types/character.ts`

Define plain-data interfaces (no Colyseus dependency — this package is consumed by both client and server):

```typescript
export interface Resource {
  current: number;
  max: number;
}

export interface Stats {
  health: Resource;
  stamina: Resource;
  essence: Resource;
}

export interface BodyHealth {
  head: Resource;
  torso: Resource;
  leftArm: Resource;
  rightArm: Resource;
  leftLeg: Resource;
  rightLeg: Resource;
}
```

### New file: `packages/shared/src/character/stats.ts`

Pure functions, following the same "single source of truth, no side effects" pattern as `packages/shared/src/movement/movement.ts`:

- `clampResource(value: number, max: number): number` — clamps to `[0, max]`. **This is a general-purpose ceiling+floor clamp, used for body-part values (which do have a max).** It is NOT used anywhere on Stats' `current` in this phase — Stats have no ceiling (per the Locked Design Decisions table), and nothing in 3a1 ever needs to clamp a stat down, so there's no call site for that yet. Do not read "no ceiling" as a property of this function; it's a property of how (and whether) it gets applied.
- `createDefaultStats(): Stats` — returns health/stamina/essence all at `{ current: 100, max: 100 }`.
- `createDefaultBodyHealth(maxHealth: number): BodyHealth` — returns all six parts at `{ current: maxHealth, max: maxHealth }`. Character creation must call this as `createDefaultBodyHealth(stats.health.max)`, not with a hardcoded `100`, so the 1:1 relationship is real rather than coincidental. Note the single scalar `maxHealth` applies uniformly to all six parts — this deliberately does not support per-part ratios (e.g. a tougher torso than arms). If a future phase needs that, the fix is a signature change (scalar → per-part ratio table) that will ripple into this function's callers and tests; that's an accepted, deferred cost, not an oversight.
- `recalculateBodyPartMaxes(bodyHealth: BodyHealth, newMaxHealth: number): BodyHealth` — returns a new `BodyHealth` where every part's `max` is set to `newMaxHealth`, and each part's `current` is clamped via `clampResource(part.current, newMaxHealth)`. Per the "Body-part current on max-shrink" rule above: this clamp is a bounds invariant (current can never exceed max), triggered only when `max` itself changes — it is not called anywhere in this phase's production code (see the "Recalculation" row above), only directly by its own unit test.

**Reminder (LESSONS_LEARNED §10):** relative imports between these new shared files (e.g. `stats.ts` importing from `types/character.ts`) must use explicit `.js` extensions — `@ruin/shared` uses NodeNext module resolution. This matches the existing convention in `movement/movement.ts` (`import { Direction } from '../types/input.js';`). Do not follow the client package's extensionless-import style here.

### Modify: `packages/shared/src/types/player.ts`

Update `IPlayer.stats` and `IPlayer.bodyHealth` to use the new `Stats` and `BodyHealth` types instead of the generic `Record<string, number>` placeholders.

### Modify: `packages/shared/src/index.ts`

Add barrel exports for the two new files, matching each file's actual category in the existing barrel rather than a single blanket pattern:

- `types/character.ts` is type-only (interfaces, no runtime values) — follow the convention already used for `player.ts`/`world.ts`/`npc.ts`: `export type { Resource, Stats, BodyHealth } from './types/character.js';`. Do NOT use `export *` for this one — that form is reserved in this file for modules with runtime values (e.g. `export * from './movement/movement.js';`), and using it here would be an inconsistent, unnecessary fork from how every other pure-type file in this barrel is exported.
- `character/stats.ts` exports runtime functions (not just types) — this one does follow the `export * from './movement/movement.js';` pattern: `export * from './character/stats.js';`.

## Part 2 — Server Colyseus Schema

### Modify: `packages/server/src/rooms/schemas/WorldState.ts`

Add three new `Schema` subclasses and wire two of them onto `PlayerState`:

```typescript
class ResourceSchema extends Schema {
  @type('number') current: number = 100;
  @type('number') max: number = 100;
}

class StatsSchema extends Schema {
  @type(ResourceSchema) health = new ResourceSchema();
  @type(ResourceSchema) stamina = new ResourceSchema();
  @type(ResourceSchema) essence = new ResourceSchema();
}

class BodyHealthSchema extends Schema {
  @type(ResourceSchema) head = new ResourceSchema();
  @type(ResourceSchema) torso = new ResourceSchema();
  @type(ResourceSchema) leftArm = new ResourceSchema();
  @type(ResourceSchema) rightArm = new ResourceSchema();
  @type(ResourceSchema) leftLeg = new ResourceSchema();
  @type(ResourceSchema) rightLeg = new ResourceSchema();
}
```

Add to `PlayerState`:
```typescript
@type(StatsSchema) stats = new StatsSchema();
@type(BodyHealthSchema) bodyHealth = new BodyHealthSchema();
```

Export `ResourceSchema`, `StatsSchema`, and `BodyHealthSchema` from this file so tests (and Phase 3d's `WorldRoom` wiring) can import them directly.

**Reminder (LESSONS_LEARNED §13):** every new `Schema` subclass is subject to the `useDefineForClassFields` footgun. The server tsconfig already has `useDefineForClassFields: false` set project-wide — do not touch that setting, just be aware these new classes rely on it.

### New file: `packages/server/src/rooms/schemas/mappers.ts`

Add four small pure functions to convert between the shared plain-data types and the Colyseus schema instances. Phase 3d needs **both directions**: hydrating `PlayerState` from a loaded `CharacterRow` on join (plain → schema), and extending `saveAll` to persist live stats/health back to the DB (schema → plain). Building only one direction here would leave 3d still having to design the other under its own time pressure, so both pairs belong in this prompt:

- `statsToSchema(stats: Stats): StatsSchema`
- `bodyHealthToSchema(bodyHealth: BodyHealth): BodyHealthSchema`
- `schemaToStats(schema: StatsSchema): Stats`
- `schemaToBodyHealth(schema: BodyHealthSchema): BodyHealth`

These just copy plain values between the two shapes — no validation or clamping logic (that's already handled where the data is produced). Do not call them from `WorldRoom` in this prompt — just implement and unit-test them so 3d only has to wire, not design.

## Part 3 — Server Persistence

### Modify: `packages/server/src/persistence/WorldPersistence.ts`

Extend `CharacterRow`:
```typescript
export interface CharacterRow {
  id: string;
  account_id: string;
  world_id: string;
  name: string;
  position_x: number;
  position_y: number;
  stats: Stats;
  body_health: BodyHealth;
  created_at: Date;
  updated_at: Date;
}
```
Unlike `world_data` (deliberately generic/evolving, hence `Record<string, unknown>`), `stats`/`body_health` now have a fully specified shape — type them strongly as `Stats`/`BodyHealth` rather than loosely. `pg` parses JSONB columns into plain JS objects automatically on `SELECT`, so no manual parsing is needed on read.

Update `createCharacter` to generate and insert real defaults instead of relying on the column's `'{}'` default:
```typescript
const stats = createDefaultStats();
const bodyHealth = createDefaultBodyHealth(stats.health.max);
// INSERT ... stats, body_health ... VALUES (..., $6, $7)
// params: ..., JSON.stringify(stats), JSON.stringify(bodyHealth)
```
Per LESSONS_LEARNED §16: **always `JSON.stringify()` before passing objects to JSONB parameterized queries** — `pg` does not auto-serialize on write, only auto-parses on read.

`getCharacter` needs no query changes — only the `CharacterRow` type change surfaces the new fields correctly.

**Stale pre-existing rows:** any character created before this change lands still has `stats`/`body_health` as `'{}'` in the DB (the column's old default), which will now mismatch the non-nullable `Stats`/`BodyHealth` types at runtime even though TypeScript sees no error. Since no real user data exists yet, reset or truncate the local dev database's `characters` table after this change lands, before manually testing. This does not affect the automated test suite — `persistence.test.ts` already truncates between tests (see LESSONS_LEARNED "Persistence tests use beforeEach truncation for isolation").

Do **not** modify `saveAll` in this prompt — it still only persists position, and that's correct until Phase 3d.

## Testing (unit level only — no `WorldRoom` integration tests)

- **`packages/shared/__tests__/stats.test.ts`** (new): `clampResource` boundary behavior — value below 0 clamps to 0, value above `max` clamps to `max`, value exactly at `max` passes through unchanged, value strictly between 0 and `max` passes through unchanged; `createDefaultStats`/`createDefaultBodyHealth` output shape and values; `recalculateBodyPartMaxes` — every part's `max` updates to the new value, a part's `current` above the new `max` is clamped down to it (per the "Body-part current on max-shrink" rule), a part's `current` already at or below the new `max` is left untouched.
- **`packages/server/__tests__/schema.test.ts`** (extend existing file): `StatsSchema`/`BodyHealthSchema`/`ResourceSchema` instantiate with correct defaults; `PlayerState` has working nested `stats`/`bodyHealth` fields; `statsToSchema`/`bodyHealthToSchema`/`schemaToStats`/`schemaToBodyHealth` correctly copy values in both directions (round-trip a `Stats`/`BodyHealth` through schema and back and assert equality).
- **`packages/server/__tests__/persistence.test.ts`** (extend existing file): `createCharacter` returns a row with real (non-empty) `stats`/`body_health` matching the shared defaults, with `body_health` maxes matching `stats.health.max`; `getCharacter` round-trips the same data back correctly (deep equality after JSON round-trip through Postgres).

## Acceptance Criteria

- `pnpm build`: zero TypeScript errors across `shared`, `server`, `client`.
- All existing tests still pass; new unit tests pass.
- `WorldRoom.ts` is untouched and the app still runs (join/leave/movement still work exactly as before — stats/health are inert, unsynced-to-gameplay data at this point).
- No new DB migration file added.
- No client-side changes of any kind.
