/**
 * Unit tests for Colyseus schema classes.
 * Tests WorldState and PlayerState instantiation and manipulation.
 */

import { describe, it, expect } from 'vitest';
import { MapSchema } from '@colyseus/schema';
import {
  WorldState,
  PlayerState,
  ResourceSchema,
  StatsSchema,
  BodyHealthSchema,
} from '../src/rooms/schemas/WorldState.js';
import {
  statsToSchema,
  bodyHealthToSchema,
  schemaToStats,
  schemaToBodyHealth,
} from '../src/rooms/schemas/mappers.js';
import type { Stats, BodyHealth } from '@ruin/shared';

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

describe('ResourceSchema', () => {
  it('instantiates with current:100, max:100 defaults', () => {
    const resource = new ResourceSchema();
    expect(resource.current).toBe(100);
    expect(resource.max).toBe(100);
  });
});

describe('StatsSchema', () => {
  it('instantiates with health, stamina, and essence all defaulted', () => {
    const stats = new StatsSchema();
    expect(stats.health).toBeInstanceOf(ResourceSchema);
    expect(stats.stamina).toBeInstanceOf(ResourceSchema);
    expect(stats.essence).toBeInstanceOf(ResourceSchema);
    expect(stats.health.current).toBe(100);
    expect(stats.stamina.max).toBe(100);
  });
});

describe('BodyHealthSchema', () => {
  it('instantiates with all six parts defaulted', () => {
    const bodyHealth = new BodyHealthSchema();
    expect(bodyHealth.head.current).toBe(100);
    expect(bodyHealth.torso.current).toBe(100);
    expect(bodyHealth.leftArm.current).toBe(100);
    expect(bodyHealth.rightArm.current).toBe(100);
    expect(bodyHealth.leftLeg.current).toBe(100);
    expect(bodyHealth.rightLeg.current).toBe(100);
  });
});

describe('PlayerState stats and bodyHealth', () => {
  it('has working nested stats and bodyHealth fields with correct defaults', () => {
    const player = new PlayerState();
    expect(player.stats).toBeInstanceOf(StatsSchema);
    expect(player.bodyHealth).toBeInstanceOf(BodyHealthSchema);
    expect(player.stats.health.current).toBe(100);
    expect(player.bodyHealth.torso.max).toBe(100);
  });

  it('allows mutating nested resource values directly', () => {
    const player = new PlayerState();
    player.stats.health.current = 42;
    player.bodyHealth.leftArm.current = 10;
    expect(player.stats.health.current).toBe(42);
    expect(player.bodyHealth.leftArm.current).toBe(10);
  });
});

describe('mappers', () => {
  const plainStats: Stats = {
    health: { current: 80, max: 100 },
    stamina: { current: 60, max: 100 },
    essence: { current: 100, max: 100 },
  };

  const plainBodyHealth: BodyHealth = {
    head: { current: 100, max: 100 },
    torso: { current: 70, max: 100 },
    leftArm: { current: 100, max: 100 },
    rightArm: { current: 100, max: 100 },
    leftLeg: { current: 100, max: 100 },
    rightLeg: { current: 100, max: 100 },
  };

  it('statsToSchema correctly copies values into a StatsSchema', () => {
    const schema = statsToSchema(plainStats);
    expect(schema).toBeInstanceOf(StatsSchema);
    expect(schema.health.current).toBe(80);
    expect(schema.stamina.current).toBe(60);
    expect(schema.essence.max).toBe(100);
  });

  it('bodyHealthToSchema correctly copies values into a BodyHealthSchema', () => {
    const schema = bodyHealthToSchema(plainBodyHealth);
    expect(schema).toBeInstanceOf(BodyHealthSchema);
    expect(schema.torso.current).toBe(70);
    expect(schema.rightLeg.max).toBe(100);
  });

  it('statsToSchema -> schemaToStats round-trips to an equal plain object', () => {
    const result = schemaToStats(statsToSchema(plainStats));
    expect(result).toEqual(plainStats);
  });

  it('bodyHealthToSchema -> schemaToBodyHealth round-trips to an equal plain object', () => {
    const result = schemaToBodyHealth(bodyHealthToSchema(plainBodyHealth));
    expect(result).toEqual(plainBodyHealth);
  });
});
