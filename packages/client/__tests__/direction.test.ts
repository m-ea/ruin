import { describe, it, expect } from 'vitest';
import { resolveDirection, KEY_TO_DIRECTION } from '../src/input/InputManager';
import { Direction } from '@ruin/shared';

describe('resolveDirection', () => {
  it('returns null when no keys are pressed', () => {
    expect(resolveDirection(new Set(), [])).toBeNull();
  });

  it('returns Direction.UP for ArrowUp', () => {
    const pressed = new Set(['ArrowUp']);
    expect(resolveDirection(pressed, ['ArrowUp'])).toBe(Direction.UP);
  });

  it('returns Direction.UP for KeyW (WASD support)', () => {
    const pressed = new Set(['KeyW']);
    expect(resolveDirection(pressed, ['KeyW'])).toBe(Direction.UP);
  });

  it('returns Direction.DOWN for ArrowDown', () => {
    const pressed = new Set(['ArrowDown']);
    expect(resolveDirection(pressed, ['ArrowDown'])).toBe(Direction.DOWN);
  });

  it('returns Direction.LEFT for KeyA', () => {
    const pressed = new Set(['KeyA']);
    expect(resolveDirection(pressed, ['KeyA'])).toBe(Direction.LEFT);
  });

  it('returns Direction.RIGHT for KeyD', () => {
    const pressed = new Set(['KeyD']);
    expect(resolveDirection(pressed, ['KeyD'])).toBe(Direction.RIGHT);
  });

  it('returns last-pressed direction when two keys are held', () => {
    // ArrowUp pressed first, then ArrowRight — last pressed wins
    const pressed = new Set(['ArrowUp', 'ArrowRight']);
    expect(resolveDirection(pressed, ['ArrowUp', 'ArrowRight'])).toBe(
      Direction.RIGHT,
    );
  });

  it('returns remaining held key when first key is released', () => {
    // ArrowUp pressed, then ArrowRight pressed, then ArrowUp released
    const pressed = new Set(['ArrowRight']); // ArrowUp no longer held
    expect(resolveDirection(pressed, ['ArrowUp', 'ArrowRight'])).toBe(
      Direction.RIGHT,
    );
  });

  it('returns null when key is pressed then released', () => {
    // Key was pressed (in keyOrder) but no longer held (not in pressedKeys)
    const pressed = new Set<string>();
    expect(resolveDirection(pressed, ['ArrowUp'])).toBeNull();
  });

  it('returns null for non-movement keys only', () => {
    const pressed = new Set(['KeyX']);
    expect(resolveDirection(pressed, ['KeyX'])).toBeNull();
  });

  it('returns correct last-pressed among remaining held keys when middle key released', () => {
    // Press order: ArrowUp, ArrowRight, ArrowDown. Release ArrowRight.
    const pressed = new Set(['ArrowUp', 'ArrowDown']);
    expect(
      resolveDirection(pressed, ['ArrowUp', 'ArrowRight', 'ArrowDown']),
    ).toBe(Direction.DOWN);
  });
});

describe('KEY_TO_DIRECTION', () => {
  it('maps all expected keys', () => {
    expect(KEY_TO_DIRECTION.size).toBe(8);
    expect(KEY_TO_DIRECTION.get('ArrowUp')).toBe(Direction.UP);
    expect(KEY_TO_DIRECTION.get('KeyW')).toBe(Direction.UP);
    expect(KEY_TO_DIRECTION.get('ArrowDown')).toBe(Direction.DOWN);
    expect(KEY_TO_DIRECTION.get('KeyS')).toBe(Direction.DOWN);
    expect(KEY_TO_DIRECTION.get('ArrowLeft')).toBe(Direction.LEFT);
    expect(KEY_TO_DIRECTION.get('KeyA')).toBe(Direction.LEFT);
    expect(KEY_TO_DIRECTION.get('ArrowRight')).toBe(Direction.RIGHT);
    expect(KEY_TO_DIRECTION.get('KeyD')).toBe(Direction.RIGHT);
  });
});
