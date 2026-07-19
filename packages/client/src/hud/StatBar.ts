/**
 * Pure, framework-free math for rendering a stat bar. No Phaser import —
 * mirrors the separation-of-concerns pattern in network/Interpolation.ts,
 * where math/logic lives here and Phaser object wiring lives in StatHud.
 */

/** Returns the pixel width the fill rectangle should render at, clamped to [0, barWidth]. */
export function computeFillWidth(current: number, max: number, barWidth: number): number {
  if (max <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, current / max));
  return barWidth * ratio;
}

/** Formats a resource pair for display, e.g. "50 / 100". */
export function formatResourceText(current: number, max: number): string {
  return `${Math.round(current)} / ${Math.round(max)}`;
}
