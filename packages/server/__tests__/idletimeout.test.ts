/**
 * Idle timeout logic tests.
 *
 * Tests the idle state machine as pure functions mirroring the logic in WorldRoom.
 * No Colyseus or DB dependencies — tests the timing rules in isolation.
 */

import { describe, it, expect } from 'vitest';

// --- Mirror of WorldRoom idle constants ---
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_WARNING_MS = 14 * 60 * 1000;

// --- Pure state machine types and helpers ---

interface IdleState {
  lastInputTime: Map<string, number>;
  idleWarned: Set<string>;
}

interface IdleCheckResult {
  warn: string[];
  kick: string[];
}

function createIdleState(): IdleState {
  return { lastInputTime: new Map(), idleWarned: new Set() };
}

function playerJoined(state: IdleState, sessionId: string, now: number): void {
  state.lastInputTime.set(sessionId, now);
}

function playerInput(state: IdleState, sessionId: string, now: number): void {
  state.lastInputTime.set(sessionId, now);
  state.idleWarned.delete(sessionId);
}

function playerLeft(state: IdleState, sessionId: string): void {
  state.lastInputTime.delete(sessionId);
  state.idleWarned.delete(sessionId);
}

function checkIdle(state: IdleState, now: number): IdleCheckResult {
  const result: IdleCheckResult = { warn: [], kick: [] };

  for (const [sessionId, lastTime] of state.lastInputTime.entries()) {
    const elapsed = now - lastTime;

    if (elapsed >= IDLE_TIMEOUT_MS) {
      result.kick.push(sessionId);
      continue;
    }

    if (elapsed >= IDLE_WARNING_MS && !state.idleWarned.has(sessionId)) {
      result.warn.push(sessionId);
      state.idleWarned.add(sessionId);
    }
  }

  return result;
}

// --- Tests ---

describe('Idle timeout state machine', () => {
  it('fresh join — not idle', () => {
    const state = createIdleState();
    playerJoined(state, 'sess-a', 0);
    const result = checkIdle(state, 1000);
    expect(result.warn).toEqual([]);
    expect(result.kick).toEqual([]);
  });

  it('active player — not idle after recent input', () => {
    const state = createIdleState();
    playerJoined(state, 'sess-a', 0);
    playerInput(state, 'sess-a', 500_000);
    // Check 100 seconds after the most recent input
    const result = checkIdle(state, 600_000);
    expect(result.warn).toEqual([]);
    expect(result.kick).toEqual([]);
  });

  it('idle 14 minutes — warning sent', () => {
    const state = createIdleState();
    playerJoined(state, 'sess-a', 0);
    const result = checkIdle(state, IDLE_WARNING_MS);
    expect(result.warn).toEqual(['sess-a']);
    expect(result.kick).toEqual([]);
  });

  it('idle 15 minutes — kicked', () => {
    const state = createIdleState();
    playerJoined(state, 'sess-a', 0);
    const result = checkIdle(state, IDLE_TIMEOUT_MS);
    expect(result.warn).toEqual([]);
    expect(result.kick).toEqual(['sess-a']);
  });

  it('warning only sent once — no spam on subsequent checks', () => {
    const state = createIdleState();
    playerJoined(state, 'sess-a', 0);

    // First check at 14 min — sends warning
    const first = checkIdle(state, IDLE_WARNING_MS);
    expect(first.warn).toEqual(['sess-a']);

    // Second check at 14.5 min — already warned, no repeat
    const second = checkIdle(state, IDLE_WARNING_MS + 30_000);
    expect(second.warn).toEqual([]);
    expect(second.kick).toEqual([]);
  });

  it('any well-formed input resets idle timer', () => {
    const state = createIdleState();
    playerJoined(state, 'sess-a', 0);

    // Goes idle enough to be warned
    checkIdle(state, IDLE_WARNING_MS);
    expect(state.idleWarned.has('sess-a')).toBe(true);

    // Player sends input (stale sequence numbers don't matter to the idle state machine)
    const inputTime = IDLE_WARNING_MS + 1000;
    playerInput(state, 'sess-a', inputTime);

    // A full warning cycle from the new input time should warn again
    const result = checkIdle(state, inputTime + IDLE_WARNING_MS);
    expect(result.warn).toEqual(['sess-a']);
    expect(result.kick).toEqual([]);
  });

  it('input clears idle warning flag', () => {
    const state = createIdleState();
    playerJoined(state, 'sess-a', 0);
    checkIdle(state, IDLE_WARNING_MS); // sets idleWarned
    expect(state.idleWarned.has('sess-a')).toBe(true);

    playerInput(state, 'sess-a', IDLE_WARNING_MS + 1000);
    expect(state.idleWarned.has('sess-a')).toBe(false);
  });

  it('multiple players — independent timers', () => {
    const state = createIdleState();
    // Player A joins and stays active
    playerJoined(state, 'sess-a', 0);
    playerInput(state, 'sess-a', IDLE_TIMEOUT_MS - 1000); // active 1s before B would be kicked

    // Player B joins at same time and goes idle
    playerJoined(state, 'sess-b', 0);

    const result = checkIdle(state, IDLE_TIMEOUT_MS);
    expect(result.kick).toEqual(['sess-b']);
    expect(result.warn).toEqual([]);
    expect(result.kick).not.toContain('sess-a');
  });

  it('player leaves — removed from idle tracking', () => {
    const state = createIdleState();
    playerJoined(state, 'sess-a', 0);
    checkIdle(state, IDLE_WARNING_MS); // triggers warning, sets idleWarned

    playerLeft(state, 'sess-a');

    expect(state.lastInputTime.has('sess-a')).toBe(false);
    expect(state.idleWarned.has('sess-a')).toBe(false);
  });

  it('exactly at warning boundary — warn triggered (>= comparison)', () => {
    const state = createIdleState();
    playerJoined(state, 'sess-a', 0);
    const result = checkIdle(state, IDLE_WARNING_MS); // exactly at boundary
    expect(result.warn).toEqual(['sess-a']);
  });

  it('exactly at kick boundary — kick triggered (>= comparison)', () => {
    const state = createIdleState();
    playerJoined(state, 'sess-a', 0);
    const result = checkIdle(state, IDLE_TIMEOUT_MS); // exactly at boundary
    expect(result.kick).toEqual(['sess-a']);
  });

  it('stale input still resets idle timer', () => {
    // The idle state machine does not know about sequence numbers — any call to
    // playerInput() (which mirrors the reset that happens before stale rejection)
    // resets the timer. A player pressing keys with stale seq numbers is still active.
    const state = createIdleState();
    playerJoined(state, 'sess-a', 0);
    // Simulate reset happening just before the warning threshold
    playerInput(state, 'sess-a', IDLE_WARNING_MS - 1000);
    // Check at what would have been the warning threshold from join time
    const result = checkIdle(state, IDLE_WARNING_MS);
    // Only 1s elapsed since last "input" — not idle
    expect(result.warn).toEqual([]);
    expect(result.kick).toEqual([]);
  });
});
