import { describe, it, expect } from 'vitest';
import { computeFillWidth, formatResourceText } from '../src/hud/StatBar';

describe('computeFillWidth', () => {
  it('returns the full bar width when current equals max', () => {
    expect(computeFillWidth(100, 100, 180)).toBe(180);
  });

  it('returns half the bar width when current is half of max', () => {
    expect(computeFillWidth(50, 100, 180)).toBe(90);
  });

  it('returns 0 when current is 0', () => {
    expect(computeFillWidth(0, 100, 180)).toBe(0);
  });

  it('clamps to the full bar width when current exceeds max', () => {
    expect(computeFillWidth(150, 100, 180)).toBe(180);
  });

  it('returns 0 when max is 0, without dividing by zero', () => {
    expect(computeFillWidth(0, 0, 180)).toBe(0);
  });

  it('fills to 50% for a non-100 max, matching the design doc example (75/150)', () => {
    expect(computeFillWidth(75, 150, 180)).toBe(90);
  });
});

describe('formatResourceText', () => {
  it('formats a standard integer case', () => {
    expect(formatResourceText(50, 100)).toBe('50 / 100');
  });

  it('rounds fractional values', () => {
    expect(formatResourceText(49.6, 100.4)).toBe('50 / 100');
  });

  it('formats the non-100-max case correctly, not defaulting to /100', () => {
    expect(formatResourceText(75, 150)).toBe('75 / 150');
  });
});
