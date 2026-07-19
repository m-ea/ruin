# Phase 3a2 Execution Prompt — Stat HUD Rendering

**Overall Progress:** `100%`

## Execution Status

- [x] 🟩 `packages/client/src/hud/StatBar.ts` (computeFillWidth, formatResourceText)
- [x] 🟩 `packages/client/src/hud/StatHud.ts` (single-container HUD, scrollFactor(0), camera-relative positioning)
- [x] 🟩 `packages/client/src/scenes/WorldScene.ts` (statHud field, onChange-driven refresh, destroy cleanup)
- [x] 🟩 `packages/client/__tests__/StatBar.test.ts` (new, 9 tests incl. non-100-max case)
- [x] 🟩 `pnpm build` — zero TypeScript errors
- [x] 🟩 Full test suite — 124/124 passing across 12 files
- [x] 🟩 Manual browser verification — dev server + Playwright-driven Chromium: three bars render bottom-left reading `100 / 100` in the correct colors, stay screen-anchored (not world-anchored) across three different player positions, zero console errors

## Prerequisite

**Depends on Phase 3a1 being complete and merged first.** This prompt assumes `PlayerState.stats` already exists on the server (a `StatsSchema` with `health`, `stamina`, `essence`, each a `{ current, max }` `ResourceSchema`) and is synchronized to clients. Do not attempt this prompt until 3a1's schema/type changes are in place — it will not compile otherwise.

## Objective

Add a client-side HUD showing the local player's Health, Stamina, and Essence as three bars. This is a pure rendering task consuming state that Phase 3a1 already syncs over the network — no server or shared-package changes.

## Explicitly Out of Scope

- **No server changes, no shared-package changes.** This prompt only touches `packages/client`.
- **No body-part health display.** Per the design doc, body-part values are not exposed in the UI yet — that's a future phase. Only the three top-level stats (Health/Stamina/Essence) are shown.
- **No party HUD.** Only the local player's own stats are shown — not other connected players.
- **No WorldRoom changes.** Since 3d (not yet executed) is what hydrates real per-character values from the database, every player will show `100 / 100` for all three bars regardless of their actual character — that is expected and correct for this prompt. The sync pipeline is real; the persisted values behind it aren't wired up yet.

## Locked Design Decisions

| Area | Decision |
|---|---|
| Bars shown | Health (red), Stamina (green), Essence (blue) |
| Bar width | Fixed — does not scale with `max`. Fill percentage (`current / max`) determines how much of the fixed width is filled |
| Bar text | Centered on each bar, reading `"{current} / {max}"` (rounded to whole numbers) |
| Scope | Local player only |
| Data source | Read live from `room.state.players.get(localSessionId).stats`, refreshed via the existing local-player `onChange` callback (not per-frame polling — see the `WorldScene.ts` section below) — do not cache/duplicate state client-side |

## Implementation

### New file: `packages/client/src/hud/StatBar.ts`

Pure, framework-free functions — no Phaser import, following the same separation-of-concerns pattern as `packages/client/src/network/Interpolation.ts` (math/logic in a plain class/module, Phaser object wiring kept separate and thin):

```typescript
/** Returns the pixel width the fill rectangle should render at, clamped to [0, barWidth]. */
export function computeFillWidth(current: number, max: number, barWidth: number): number {
  if (max <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, current / max));
  return barWidth * ratio;
}

/** Formats a resource pair for display, e.g. "50 / 100". */
export function formatResourceText(current: number, max: number): string {
  return `${Math.round(current)} / ${Math.round(max)}`;
}
```

### New file: `packages/client/src/hud/StatHud.ts`

A thin class that owns the Phaser display objects and refreshes them from plain `{ current, max }` data. It should NOT reach into `room.state` itself — `WorldScene` passes it plain values, keeping this class testable-in-spirit even though (like `RemotePlayerInterpolation`'s Phaser-adjacent callers) the actual Phaser object creation isn't unit tested.

Requirements — follow the **actual** existing overlay pattern in `WorldScene.ts` (`showIdleWarningOverlay`/`showDisconnectOverlay`) precisely, not an approximation of it: **one** `Phaser.GameObjects.Container` for the whole HUD (not one per bar), created via `this.add.container(0, 0)`, with `.setScrollFactor(0)` called on it explicitly (the camera follows the local player via `startFollow` — without this the HUD scrolls with the world instead of staying screen-anchored) and `.setDepth(...)` set explicitly.

- Constructor takes the `Phaser.Scene`. Read `const { width, height } = scene.cameras.main;` (matching how the existing overlays get screen dimensions) — do NOT hardcode `800`/`600`, even though that's the current config in `main.ts`.
- Build three bars as children of the single container, each consisting of: a background rectangle (dark gray, `0x333333`, fixed size), a foreground fill rectangle (colored, width driven by `computeFillWidth`), and a centered `Phaser.GameObjects.Text` showing `formatResourceText` output.
- Bar dimensions: 180px wide, 20px tall, 4px vertical gap between bars.
- Colors: define three named constants local to this file — `HEALTH_COLOR = 0xc0392b` (dark red), `STAMINA_COLOR = 0x27ae60` (dark green), `ESSENCE_COLOR = 0x2e86de` (blue). These are deliberately different exact shades from `WorldScene.ts`'s existing `REMOTE_COLORS[0]` (`0xe74c3c`), `REMOTE_COLORS[1]` (`0x2ecc71`), the local player sprite color (`0x3498db`), and the water tile color (`0x2980b9`) — reusing an identical hex already meaning something else on screen would create a coincidental, confusing visual association. Background rectangles all `0x333333`. (Centralizing every on-screen color — sprites, tiles, and HUD — into one shared module is a reasonable future cleanup, but out of scope here; these three constants living in `StatHud.ts` is sufficient for this prompt.)
- Position: anchored to the bottom-left of the camera viewport (`width`/`height` from above) with a 10px margin from the left and bottom edges, stacked vertically — Health on top, then Stamina, then Essence.
- Depth: `500` — low enough to sit below the idle-warning banner (999) and disconnect overlay (1000). Note there is no shared z-index constant/scheme in this codebase yet (999 and 1000 are themselves ad-hoc); `500` is simply chosen to stay clear of both. Introducing a shared depth-layering convention is out of scope for this prompt.
- Public method `update(stats: { health: Resource; stamina: Resource; essence: Resource }): void` (import `Resource` from `@ruin/shared`) — recomputes fill widths and text for all three bars by mutating the existing `Rectangle`/`Text` objects in place (`.width =`, `.setText(...)`) — never destroy/recreate them.
- Public method `destroy(): void` — destroys the container (which destroys its children). See the `WorldScene.ts` modification section below for an important caveat about when this actually runs.
- The fill rectangle's origin should stay left-anchored so it visually depletes right-to-left as `current` drops (i.e., set its `setOrigin(0, 0.5)` or equivalent and only change `width`, not `x`). The text stays centered on the *fixed* bar bounds regardless of fill level.

### Modify: `packages/client/src/scenes/WorldScene.ts`

Do **not** poll `room.state` from the 60Hz `update()` loop for this. The codebase's established pattern for reacting to local-player state changes is the `player.onChange(() => {...})` callback already registered inside `setupRoomListeners()`'s `isLocal` branch (this is literally how `reconcile()` itself gets triggered) — stats only change server-side, so an onChange-driven refresh is both more consistent with the rest of the file and strictly cheaper than an unconditional 60Hz poll.

- Add `private statHud: StatHud | null = null;` alongside the other overlay/interpolation fields.
- In `create()`, instantiate `this.statHud = new StatHud(this);` before `setupRoomListeners()` is called (so it exists by the time any Colyseus event fires — those are always async relative to `create()`'s synchronous body, so any earlier point in `create()` is equally safe).
- In `setupRoomListeners()`, inside the existing `if (isLocal) { ... }` branch:
  - Immediately after the existing camera/interpolation setup (before the `player.onChange(...)` registration), add one initial refresh so the HUD shows correct values right away rather than waiting for the first change:
    ```typescript
    this.statHud?.update({
      health: player.stats.health,
      stamina: player.stats.stamina,
      essence: player.stats.essence,
    });
    ```
  - Inside the existing `player.onChange(() => { ... })` callback for the local player, add the same refresh call at the top (before the existing reconciliation logic) so the HUD updates whenever `stats` changes:
    ```typescript
    this.statHud?.update({
      health: player.stats.health,
      stamina: player.stats.stamina,
      essence: player.stats.essence,
    });
    ```
    Note this `onChange` fires on *any* field change (position included), not just stats — that's fine here since recomputing three bars is cheap and this still fires far less often than a 60Hz poll would.
- In `destroy()`, add `this.statHud?.destroy();` alongside the existing overlay cleanup. **Caveat:** `WorldScene.destroy()` is a plain method with no wiring to any Phaser scene lifecycle event — nothing in the file currently calls it, and Phaser does not invoke it automatically. This is a pre-existing gap, not something introduced by this prompt, and fixing it is out of scope here. Add the line anyway (for whenever that gap is eventually closed), but do not treat it as a proven cleanup path in the manual verification step.

## Testing

- **`packages/client/__tests__/StatBar.test.ts`** (new): unit tests for `computeFillWidth` (full bar, half bar, zero current, current exceeding max is clamped to full width, `max` of 0 doesn't divide-by-zero, **and a non-100 max** — e.g. `current: 75, max: 150` must fill to 50%, matching the design doc's own worked example) and `formatResourceText` (rounds fractional values, standard integer case, and the same non-100-max case: `formatResourceText(75, 150)` must read `"75 / 150"`, not `"75 / 100"`).
- No unit test for `StatHud` itself — consistent with how `RemotePlayerInterpolation`'s math is unit-tested but its Phaser-side sprite wiring in `WorldScene` is not. Verify `StatHud` manually per the project's UI-change convention (see below).

## Manual Verification (required before reporting done)

Start the dev server, join a world, and confirm in-browser:
- Three bars appear bottom-left: red (Health), green (Stamina), blue (Essence), each full and reading `100 / 100`.
- Bars stay fixed-width and correctly positioned as the player moves around.
- No visual collision with the idle-warning banner or disconnect overlay when those trigger.

## Acceptance Criteria

- `pnpm build`: zero TypeScript errors.
- All existing tests still pass; new `StatBar.test.ts` tests pass.
- No changes outside `packages/client`.
- Manual browser verification completed (per the project convention that UI changes must be checked in a running browser, not just type-checked).
