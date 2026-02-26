import { describe, it, expect } from 'vitest';
import { RemotePlayerInterpolation } from '../src/network/Interpolation';

// All tests assume TICK_RATE = 20, so TICK_INTERVAL_MS = 50ms.

describe('RemotePlayerInterpolation', () => {
  it('returns initial position immediately', () => {
    const interp = new RemotePlayerInterpolation(5, 5);
    const pos = interp.getPosition();
    expect(pos.x).toBe(5);
    expect(pos.y).toBe(5);
  });

  it('advance has no effect when no movement target set', () => {
    const interp = new RemotePlayerInterpolation(5, 5);
    interp.advance(25);
    const pos = interp.getPosition();
    expect(pos.x).toBe(5);
    expect(pos.y).toBe(5);
  });

  it('linear interpolation at midpoint', () => {
    const interp = new RemotePlayerInterpolation(5, 5);
    interp.updateTarget(6, 5);
    interp.advance(25);
    const pos = interp.getPosition();
    expect(pos.x).toBeCloseTo(5.5, 5);
    expect(pos.y).toBe(5);
  });

  it('linear interpolation at quarter', () => {
    const interp = new RemotePlayerInterpolation(5, 5);
    interp.updateTarget(6, 5);
    interp.advance(12.5);
    const pos = interp.getPosition();
    expect(pos.x).toBeCloseTo(5.25, 5);
  });

  it('interpolation completes at tick interval', () => {
    const interp = new RemotePlayerInterpolation(5, 5);
    interp.updateTarget(6, 5);
    interp.advance(50);
    const pos = interp.getPosition();
    expect(pos.x).toBe(6);
    expect(pos.y).toBe(5);
  });

  it('interpolation clamps beyond tick interval', () => {
    const interp = new RemotePlayerInterpolation(5, 5);
    interp.updateTarget(6, 5);
    interp.advance(100);
    const pos = interp.getPosition();
    expect(pos.x).toBe(6);
    expect(pos.y).toBe(5);
  });

  it('multiple advances accumulate', () => {
    const interp = new RemotePlayerInterpolation(5, 5);
    interp.updateTarget(6, 5);
    interp.advance(10);
    interp.advance(15);
    const pos = interp.getPosition();
    expect(pos.x).toBeCloseTo(5.5, 5);
  });

  it('updateTarget mid-interpolation captures current visual position', () => {
    const interp = new RemotePlayerInterpolation(5, 5);
    interp.updateTarget(6, 5);
    interp.advance(25); // visually at (5.5, 5.0)

    interp.updateTarget(5, 6); // redirect — previous becomes current visual (5.5, 5.0)
    const posAtStart = interp.getPosition();
    expect(posAtStart.x).toBeCloseTo(5.5, 5);
    expect(posAtStart.y).toBeCloseTo(5.0, 5);

    interp.advance(25); // midpoint between (5.5, 5.0) and (5, 6)
    const posAtMid = interp.getPosition();
    expect(posAtMid.x).toBeCloseTo(5.25, 5);
    expect(posAtMid.y).toBeCloseTo(5.5, 5);
  });

  it('stationary updateTarget is ignored', () => {
    const interp = new RemotePlayerInterpolation(5, 5);
    interp.updateTarget(5, 5);
    expect(interp.getPosition()).toEqual({ x: 5, y: 5 });
    interp.advance(25);
    expect(interp.getPosition()).toEqual({ x: 5, y: 5 });
  });

  it('vertical movement', () => {
    const interp = new RemotePlayerInterpolation(5, 5);
    interp.updateTarget(5, 6);
    interp.advance(25);
    const pos = interp.getPosition();
    expect(pos.y).toBeCloseTo(5.5, 5);
    expect(pos.x).toBe(5);
  });

  it('diagonal target (safety check - both axes interpolate)', () => {
    const interp = new RemotePlayerInterpolation(5, 5);
    interp.updateTarget(6, 6);
    interp.advance(25);
    const pos = interp.getPosition();
    expect(pos.x).toBeCloseTo(5.5, 5);
    expect(pos.y).toBeCloseTo(5.5, 5);
  });
});
