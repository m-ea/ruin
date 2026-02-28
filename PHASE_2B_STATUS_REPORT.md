# Phase 2b Status Report — Hosting Model (Idle Timeout, Host Tracking, Disconnect Handling)

**Date:** 2026-02-28
**Branch:** master
**Prior test count:** 80 (10 files)
**Final test count:** 92 (10 files → 1 new `__tests__` file added)

---

## Summary

Phase 2b is complete. Deliverables: host session tracking, 15-minute idle timeout with 1-minute warning, client-side overlays for idle warning and disconnect, and 12 new idle timeout unit tests.

Build: **zero TypeScript errors.**
Tests: **92/92 passing.**

No new npm packages were installed.

---

## Files Created

### `packages/server/__tests__/idletimeout.test.ts`
12 unit tests for the idle timeout state machine as pure functions (no Colyseus, no DB). Mirrors the logic in `WorldRoom` via standalone helper functions that parallel the instance methods. Tests cover:

1. Fresh join — not idle
2. Active player — not idle after recent input
3. Idle 14 minutes — warning sent
4. Idle 15 minutes — kicked
5. Warning only sent once (no repeat on subsequent checks)
6. Any well-formed input resets idle timer (full warning cycle from new baseline)
7. Input clears idle warning flag
8. Multiple players — independent timers (A active, B idle → only B kicked)
9. Player leaves — removed from idle tracking (no memory leak)
10. Exactly at warning boundary — warn triggered (`>=` comparison)
11. Exactly at kick boundary — kick triggered (`>=` comparison)
12. Stale input still resets idle timer (idle measures engagement, not sync health)

---

## Files Modified

### `packages/shared/src/constants/network.ts`
Added two new message type entries:
```typescript
IDLE_WARNING = 'idle_warning',
IDLE_KICK = 'idle_kick',
```

### `packages/shared/src/types/messages.ts`
Added `IdleWarningMessage`, `IdleKickMessage` interfaces and populated `ServerToClientMessages`:
```typescript
export interface IdleWarningMessage {
  secondsRemaining: number;
}
export interface IdleKickMessage {
  reason: string;
}
export interface ServerToClientMessages {
  [MessageType.IDLE_WARNING]: IdleWarningMessage;
  [MessageType.IDLE_KICK]: IdleKickMessage;
}
```

### `packages/server/src/rooms/WorldRoom.ts`

**New static constants:**
```typescript
private static readonly IDLE_TIMEOUT_MS = 15 * 60 * 1000;   // 15 minutes
private static readonly IDLE_WARNING_MS = 14 * 60 * 1000;   // warn at 14 minutes
private static readonly IDLE_CHECK_INTERVAL_MS = 30_000;     // check every 30s
```

**New instance properties:**
- `hostSessionId: string | null` — session ID of the currently connected host (null when host is offline)
- `lastInputTime: Map<string, number>` — last input timestamp per session
- `idleWarned: Set<string>` — tracks which sessions have already been warned (prevents spam)
- `idleCheckInterval: ReturnType<typeof setInterval> | null` — interval handle for idle checker

**`onCreate`:** Added idle check interval startup after auto-save interval:
```typescript
this.idleCheckInterval = setInterval(() => this.checkIdlePlayers(), WorldRoom.IDLE_CHECK_INTERVAL_MS);
```

**`handleInput`:** Added idle timer reset between player validation and stale sequence rejection:
```typescript
// Reset idle timer on any well-formed input from a valid player.
// Intentionally before stale rejection — idle timeout measures player engagement,
// not synchronization health.
this.lastInputTime.set(client.sessionId, Date.now());
this.idleWarned.delete(client.sessionId);
```

**`onJoin`:** Added host tracking after first-joiner check, and idle time initialization after player is added to state:
```typescript
const isHost = accountId === this.hostAccountId;
if (isHost) {
  this.hostSessionId = client.sessionId;
  sessionLogger.info('Host player joined');
}
// ... (after state.players.set)
this.lastInputTime.set(client.sessionId, Date.now());
```

**`onLeave`:** Added host session clear and idle state cleanup:
```typescript
if (client.sessionId === this.hostSessionId) {
  this.hostSessionId = null;
  this.roomLogger.info({ sessionId: client.sessionId }, 'Host player left');
}
// ... (existing save and cleanup)
this.lastInputTime.delete(client.sessionId);
this.idleWarned.delete(client.sessionId);
```

**`onDispose`:** Added idle check interval cleanup alongside auto-save interval:
```typescript
if (this.idleCheckInterval) {
  clearInterval(this.idleCheckInterval);
  this.idleCheckInterval = null;
}
```

**New method — `checkIdlePlayers()`:** Iterates `lastInputTime`, computes elapsed time, sends `IDLE_KICK` + `client.leave(4005)` at 15 minutes, sends `IDLE_WARNING` once at 14 minutes. Players are checked independently.

### `packages/client/src/scenes/WorldScene.ts`

**New instance properties:**
```typescript
private disconnectOverlay: Phaser.GameObjects.Container | null = null;
private idleWarningOverlay: Phaser.GameObjects.Container | null = null;
private idleCountdownText: Phaser.GameObjects.Text | null = null;
private idleCountdownTimer: Phaser.Time.TimerEvent | null = null;
private idleSecondsRemaining: number = 0;
```

**`create()`:** Added `this.setupLifecycleListeners()` after existing `setupRoomListeners()` call.

**`clientTick()`:** Added idle warning dismissal on any input (right after `if (!direction) return;`):
```typescript
if (this.idleWarningOverlay) {
  this.hideIdleWarningOverlay();
}
```

**`destroy()`:** Added cleanup for both overlays.

**New methods:**
- `setupLifecycleListeners()` — registers `idle_warning`, `idle_kick`, and `onLeave` handlers. The `onLeave` guard (`if (this.disconnectOverlay) return`) prevents a double-overlay when the client receives `idle_kick` followed by the WebSocket close event.
- `showIdleWarningOverlay(secondsRemaining)` — non-blocking banner at screen top with a 1-second countdown timer. Depth 999.
- `hideIdleWarningOverlay()` — removes timer and destroys container.
- `showDisconnectOverlay(reason)` — full-screen dark overlay with "Disconnected" title and reason. Triggers `window.location.reload()` after 3 seconds to return to lobby. Depth 1000.

### `LESSONS_LEARNED.md`
Added four new sections:
- **19. Vite Proxy for New Route Prefixes** — documents the bug caught during 2a testing
- **20. Idle Timeout Pattern** — timing approximation, idle reset before stale rejection, cleanup in onLeave
- **21. Close Code Registry** — table of 4001/4002/4005 codes
- **22. Hosting Model — Minecraft Realms Approach** — hostSessionId tracking, autoDispose behavior

Updated Quick Reference:
- `@ruin/shared` packages line: added IDLE_WARNING/IDLE_KICK, IdleWarningMessage, IdleKickMessage
- Colyseus section: added hostSessionId, idle timeout parameters, updated close codes
- Client section: added idle warning/disconnect overlay description
- Tests section: updated count to 92, added `fileParallelism: false` note

---

## Decisions Not Specified in the Prompt

### Test count is 92, not 91

The prompt specified "~11 new idle timeout tests" but the implementation produced 12 (test case 12 — "stale input still resets idle timer" — was listed as an addition in the prompt's Section 5 diff, so this was intentional).

### `window.location.reload()` for lobby return

The `showDisconnectOverlay` returns to lobby via `window.location.reload()` after 3 seconds, as specified in the prompt. A comment was added noting this is pragmatic — proper Phaser scene navigation is future work.

### Idle timer initialized on join, not on first input

`lastInputTime.set(client.sessionId, Date.now())` is called at the end of `onJoin`, after the player is added to state. This means the 15-minute clock starts from join time, not from the first movement. This is the correct behavior — a player who joins and immediately goes AFK should still be kicked.

---

## Issues Encountered

None. Build and tests passed on the first attempt.

---

## Test Results

```
Test Files   10 passed (10)
Tests        92 passed (92)
Duration      9.09s
```

| File | Tests | Status |
|------|-------|--------|
| `packages/server/__tests__/auth.test.ts` | 8 | ✓ |
| `packages/server/__tests__/idletimeout.test.ts` | 12 | ✓ NEW |
| `packages/server/__tests__/movement.test.ts` | 10 | ✓ |
| `packages/server/__tests__/persistence.test.ts` | 13 | ✓ |
| `packages/server/__tests__/schema.test.ts` | 4 | ✓ |
| `packages/server/__tests__/worldRoutes.test.ts` | 8 | ✓ |
| `packages/client/__tests__/direction.test.ts` | 11 | ✓ |
| `packages/client/__tests__/Interpolation.test.ts` | 8 | ✓ |
| `packages/client/__tests__/PredictionBuffer.test.ts` | 7 | ✓ |
| `packages/shared/__tests__/movement.test.ts` | 11 | ✓ |

---

## Build

```
pnpm build: 0 TypeScript errors (shared, server, client all pass)
```

---

## Functional Confirmation

The following behaviors are implemented end-to-end:

1. **Host tracking:** When the world owner joins, `hostSessionId` is set to their session ID. When they leave, it is cleared to null. Guests can keep the room alive — host presence is not required.

2. **Idle warning (14 min):** At 14 minutes of inactivity (no valid input), `IDLE_WARNING` is sent with `secondsRemaining`. The client shows a non-blocking yellow banner with a 1-second countdown. The banner is dismissed client-side on the next movement key press (which also resets the server-side idle timer). Warning is only sent once per idle cycle.

3. **Idle kick (15 min):** At 15 minutes of inactivity, `IDLE_KICK` is sent, then `client.leave(4005)` is called. The client receives the kick message first, hides the warning banner, and shows the disconnect overlay. The `onLeave` guard prevents a second overlay from appearing when the WebSocket close event fires.

4. **Disconnect overlay:** Full-screen dark overlay with "Disconnected" title and the reason string. Automatically reloads the page after 3 seconds, returning the player to the lobby.

5. **Disconnect on other close codes:** `onLeave` handles 4001 (auth fail), 4002 (ownership fail), and any other 4xxx code with appropriate messages. Normal close codes (< 4000) produce no overlay.

6. **Cleanup:** All idle state is removed in `onLeave` (no memory leaks). The idle check interval is cleared in `onDispose`.

---

## What Phase 2b Does Not Include

- Guest join approval by host (future admin feature)
- Whitelist / invite system
- Host-initiated kick of other players
- Proper Phaser scene navigation (disconnect returns via `window.location.reload()`)
