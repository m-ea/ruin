import { Direction } from '../types/input.js';
import { GameMap, PASSABLE_TILES } from '../types/map.js';

/**
 * Movement delta lookup for each direction.
 */
const DIRECTION_DELTAS: Record<Direction, { dx: number; dy: number }> = {
  [Direction.UP]: { dx: 0, dy: -1 },
  [Direction.DOWN]: { dx: 0, dy: 1 },
  [Direction.LEFT]: { dx: -1, dy: 0 },
  [Direction.RIGHT]: { dx: 1, dy: 0 },
};

/**
 * Attempts to move from (currentX, currentY) in the given direction.
 *
 * Pure function. No side effects. Fully deterministic.
 * This is the SINGLE SOURCE OF TRUTH for movement validation
 * on both client and server.
 *
 * @returns New position and whether the move succeeded.
 */
export function tryMove(
  map: GameMap,
  currentX: number,
  currentY: number,
  direction: Direction,
): { x: number; y: number; moved: boolean } {
  const { dx, dy } = DIRECTION_DELTAS[direction];
  const targetX = currentX + dx;
  const targetY = currentY + dy;

  // Bounds check
  if (targetX < 0 || targetX >= map.width || targetY < 0 || targetY >= map.height) {
    return { x: currentX, y: currentY, moved: false };
  }

  // Passability check — tiles indexed as tiles[y][x]
  const tile = map.tiles[targetY]![targetX]!;
  if (!PASSABLE_TILES.has(tile)) {
    return { x: currentX, y: currentY, moved: false };
  }

  return { x: targetX, y: targetY, moved: true };
}

/**
 * Processes a single player's input against the map.
 * Used by the server tick loop and client prediction.
 *
 * Pure function — takes current state, returns new state.
 * Does NOT mutate any arguments.
 *
 * For Phase 1, this simply delegates to tryMove. It exists as a separate
 * function because future phases will add pre/post-processing (stamina cost,
 * event triggers, combat interruption, etc.) without changing the interface.
 */
export function processPlayerInput(
  map: GameMap,
  currentX: number,
  currentY: number,
  direction: Direction,
): { x: number; y: number; moved: boolean } {
  return tryMove(map, currentX, currentY, direction);
}
