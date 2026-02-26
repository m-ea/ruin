import { TICK_RATE } from '@ruin/shared';

const TICK_INTERVAL_MS = 1000 / TICK_RATE; // 50ms at 20Hz

/**
 * Interpolates a remote player's visual position between server state updates.
 *
 * Design notes:
 * - This class does NOT buffer multiple future targets. It always lerps toward
 *   the latest authoritative position. If two patches arrive in the same frame,
 *   the intermediate position is skipped visually. This is acceptable because
 *   server ticks are 20Hz (50ms apart) and burst patches are rare.
 * - The x/y values are TILE coordinates (integers for targets, floats during
 *   interpolation). The caller converts to pixel positions for rendering.
 */
export class RemotePlayerInterpolation {
  private previousX: number;
  private previousY: number;
  private targetX: number;
  private targetY: number;
  private elapsedMs: number = 0;
  private interpolating: boolean = false;

  constructor(initialX: number, initialY: number) {
    this.previousX = initialX;
    this.previousY = initialY;
    this.targetX = initialX;
    this.targetY = initialY;
  }

  /**
   * Sets a new interpolation target.
   * Captures the current visual position as the new start point so that
   * mid-interpolation direction changes produce smooth transitions.
   */
  updateTarget(newX: number, newY: number): void {
    if (newX === this.targetX && newY === this.targetY) return;
    const current = this.getPosition();
    this.previousX = current.x;
    this.previousY = current.y;
    this.targetX = newX;
    this.targetY = newY;
    this.elapsedMs = 0;
    this.interpolating = true;
  }

  /**
   * Advances the interpolation by deltaMs milliseconds.
   * Clamps at TICK_INTERVAL_MS — does not overshoot the target.
   */
  advance(deltaMs: number): void {
    if (!this.interpolating) return;
    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= TICK_INTERVAL_MS) {
      this.elapsedMs = TICK_INTERVAL_MS;
      this.interpolating = false;
    }
  }

  /**
   * Returns the current interpolated position in tile coordinates.
   * Returns the exact target when not interpolating.
   */
  getPosition(): { x: number; y: number } {
    if (!this.interpolating) {
      return { x: this.targetX, y: this.targetY };
    }
    const t = this.elapsedMs / TICK_INTERVAL_MS;
    return {
      x: this.previousX + (this.targetX - this.previousX) * t,
      y: this.previousY + (this.targetY - this.previousY) * t,
    };
  }

  /**
   * Returns the authoritative target position (useful for debugging).
   */
  getCurrentTarget(): { x: number; y: number } {
    return { x: this.targetX, y: this.targetY };
  }
}
