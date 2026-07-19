import type { Resource, Stats, BodyHealth } from '../types/character.js';

/**
 * Clamps a value to [0, max]. General-purpose ceiling+floor clamp, used for
 * body-part values (which do have a max). NOT used on Stats' `current` —
 * Stats have no ceiling by design, so nothing in this module ever clamps one down.
 */
export function clampResource(value: number, max: number): number {
  return Math.max(0, Math.min(value, max));
}

/**
 * Returns the default starting Stats for a new character:
 * health, stamina, and essence all at { current: 100, max: 100 }.
 */
export function createDefaultStats(): Stats {
  return {
    health: { current: 100, max: 100 },
    stamina: { current: 100, max: 100 },
    essence: { current: 100, max: 100 },
  };
}

/**
 * Returns default body-part health, all six parts at { current: maxHealth, max: maxHealth }.
 *
 * Callers must pass `stats.health.max` (not a hardcoded 100) so the 1:1 relationship
 * between a character's max Health and every body part's max is real, not coincidental.
 */
export function createDefaultBodyHealth(maxHealth: number): BodyHealth {
  const part: Resource = { current: maxHealth, max: maxHealth };
  return {
    head: { ...part },
    torso: { ...part },
    leftArm: { ...part },
    rightArm: { ...part },
    leftLeg: { ...part },
    rightLeg: { ...part },
  };
}

/**
 * Returns a new BodyHealth reflecting a change to the character's max Health.
 *
 * Every part's `max` is set to `newMaxHealth` (1:1 relationship). Each part's
 * `current` is clamped down via clampResource if it now exceeds the new max —
 * this is a bounds invariant (current can never exceed max), triggered only
 * when max itself shrinks. It is NOT a damage event, and is independent of
 * the "current ↔ current" rule that governs damage/healing scenarios.
 *
 * Not called anywhere in Phase 3a1's production code (createCharacter only ever
 * calls createDefaultBodyHealth, since there's no pre-existing max to recalculate
 * from at creation time) — this exists now so it's ready for Phase 4+.
 */
export function recalculateBodyPartMaxes(
  bodyHealth: BodyHealth,
  newMaxHealth: number,
): BodyHealth {
  const recalculate = (part: Resource): Resource => ({
    current: clampResource(part.current, newMaxHealth),
    max: newMaxHealth,
  });

  return {
    head: recalculate(bodyHealth.head),
    torso: recalculate(bodyHealth.torso),
    leftArm: recalculate(bodyHealth.leftArm),
    rightArm: recalculate(bodyHealth.rightArm),
    leftLeg: recalculate(bodyHealth.leftLeg),
    rightLeg: recalculate(bodyHealth.rightLeg),
  };
}
