/**
 * Tile types for the game map.
 * Extensible — new types can be added without breaking existing maps.
 */
export enum TileType {
  GROUND = 0,
  WALL = 1,
  WATER = 2,
}

/**
 * Defines which tile types are passable (can be walked on).
 * Used by tryMove() for collision checking.
 */
export const PASSABLE_TILES: ReadonlySet<TileType> = new Set([TileType.GROUND]);

/**
 * Game map data structure.
 *
 * CRITICAL: tiles is indexed as tiles[y][x] (row-major).
 * - y is the row index (0 = top of map)
 * - x is the column index (0 = left of map)
 * - tiles[0][0] is the top-left corner
 * - tiles[height-1][width-1] is the bottom-right corner
 *
 * This convention matches how 2D arrays are naturally written in code:
 * each inner array is a row from left to right,
 * and the outer array goes from top to bottom.
 */
export interface GameMap {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly (readonly TileType[])[];
  readonly spawnX: number;
  readonly spawnY: number;
}
