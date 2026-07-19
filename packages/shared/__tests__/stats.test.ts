import { describe, it, expect } from 'vitest';
import {
  clampResource,
  createDefaultStats,
  createDefaultBodyHealth,
  recalculateBodyPartMaxes,
} from '../src/character/stats.js';
import type { BodyHealth } from '../src/types/character.js';

describe('clampResource', () => {
  it('clamps a value below 0 up to 0', () => {
    expect(clampResource(-10, 100)).toBe(0);
  });

  it('clamps a value above max down to max', () => {
    expect(clampResource(150, 100)).toBe(100);
  });

  it('passes through a value exactly at max unchanged', () => {
    expect(clampResource(100, 100)).toBe(100);
  });

  it('passes through a value strictly between 0 and max unchanged', () => {
    expect(clampResource(42, 100)).toBe(42);
  });
});

describe('createDefaultStats', () => {
  it('returns health, stamina, and essence all at current:100, max:100', () => {
    const stats = createDefaultStats();
    expect(stats).toEqual({
      health: { current: 100, max: 100 },
      stamina: { current: 100, max: 100 },
      essence: { current: 100, max: 100 },
    });
  });
});

describe('createDefaultBodyHealth', () => {
  it('returns all six parts at current:maxHealth, max:maxHealth', () => {
    const bodyHealth = createDefaultBodyHealth(100);
    expect(bodyHealth).toEqual({
      head: { current: 100, max: 100 },
      torso: { current: 100, max: 100 },
      leftArm: { current: 100, max: 100 },
      rightArm: { current: 100, max: 100 },
      leftLeg: { current: 100, max: 100 },
      rightLeg: { current: 100, max: 100 },
    });
  });

  it('uses the passed-in maxHealth rather than a hardcoded 100', () => {
    const bodyHealth = createDefaultBodyHealth(150);
    expect(bodyHealth.head).toEqual({ current: 150, max: 150 });
    expect(bodyHealth.rightLeg).toEqual({ current: 150, max: 150 });
  });

  it('produces independent object references per part (no shared mutation)', () => {
    const bodyHealth = createDefaultBodyHealth(100);
    bodyHealth.head.current = 50;
    expect(bodyHealth.torso.current).toBe(100);
  });
});

describe('recalculateBodyPartMaxes', () => {
  const bodyHealth: BodyHealth = createDefaultBodyHealth(100);

  it("updates every part's max to the new value", () => {
    const result = recalculateBodyPartMaxes(bodyHealth, 50);
    expect(result.head.max).toBe(50);
    expect(result.torso.max).toBe(50);
    expect(result.leftArm.max).toBe(50);
    expect(result.rightArm.max).toBe(50);
    expect(result.leftLeg.max).toBe(50);
    expect(result.rightLeg.max).toBe(50);
  });

  it('clamps a part current down when it exceeds the new max', () => {
    const damaged: BodyHealth = {
      ...createDefaultBodyHealth(100),
      head: { current: 80, max: 100 },
    };
    const result = recalculateBodyPartMaxes(damaged, 50);
    expect(result.head).toEqual({ current: 50, max: 50 });
  });

  it('leaves a part current untouched when it is already at or below the new max', () => {
    const damaged: BodyHealth = {
      ...createDefaultBodyHealth(100),
      head: { current: 30, max: 100 },
    };
    const result = recalculateBodyPartMaxes(damaged, 50);
    expect(result.head).toEqual({ current: 30, max: 50 });
  });

  it('returns a new object rather than mutating the input', () => {
    const original: BodyHealth = createDefaultBodyHealth(100);
    const originalHeadMax = original.head.max;
    recalculateBodyPartMaxes(original, 50);
    expect(original.head.max).toBe(originalHeadMax);
  });
});
