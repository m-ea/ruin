/**
 * Unit tests for Colyseus schema classes.
 * Tests WorldState and PlayerState instantiation and manipulation.
 */

import { describe, it, expect } from 'vitest';
import { MapSchema } from '@colyseus/schema';
import { WorldState, PlayerState } from '../src/rooms/schemas/WorldState.js';

describe('Colyseus Schemas', () => {
  it('WorldState can be instantiated with an empty players map', () => {
    const state = new WorldState();

    expect(state.players).toBeInstanceOf(MapSchema);
    expect(state.players.size).toBe(0);
  });

  it('PlayerState can be instantiated with default values', () => {
    const player = new PlayerState();

    expect(player.sessionId).toBe('');
    expect(player.name).toBe('');
    expect(player.x).toBe(0);
    expect(player.y).toBe(0);
  });

  it('Adding a PlayerState to WorldState works', () => {
    const state = new WorldState();
    const player = new PlayerState();

    // Set player values
    player.sessionId = 'session-123';
    player.name = 'TestPlayer';
    player.x = 5;
    player.y = 10;

    // Add to players map
    state.players.set('session-123', player);

    // Verify it exists and fields match
    expect(state.players.size).toBe(1);
    expect(state.players.has('session-123')).toBe(true);

    const retrieved = state.players.get('session-123');
    expect(retrieved).toBeDefined();
    expect(retrieved?.sessionId).toBe('session-123');
    expect(retrieved?.name).toBe('TestPlayer');
    expect(retrieved?.x).toBe(5);
    expect(retrieved?.y).toBe(10);
  });

  it('Removing a PlayerState from WorldState works', () => {
    const state = new WorldState();
    const player = new PlayerState();

    player.sessionId = 'session-456';
    player.name = 'TestPlayer2';

    // Add player
    state.players.set('session-456', player);
    expect(state.players.size).toBe(1);

    // Remove player
    state.players.delete('session-456');
    expect(state.players.size).toBe(0);
    expect(state.players.has('session-456')).toBe(false);
  });
});
