/**
 * Town map - 32x32 tile-based map for MVP gameplay.
 *
 * Features:
 * - Fully walled perimeter
 * - Small building outline near top-left (collision test structure)
 * - Scattered wall tiles (rocks) for obstacle testing
 * - Water pond (non-wall, non-passable tile test)
 * - Open ground for movement
 */

import { GameMap, TileType } from '../types/map.js';

// Convenient aliases for readability
const G = TileType.GROUND;
const W = TileType.WALL;
const T = TileType.WATER; // T for waTer to avoid confusion with W

/**
 * 32x32 town map.
 *
 * Indexed as tiles[y][x] where:
 * - y = row (0 = top, 31 = bottom)
 * - x = column (0 = left, 31 = right)
 */
export const TOWN_MAP: GameMap = {
  width: 32,
  height: 32,
  spawnX: 16,
  spawnY: 16,
  tiles: [
    // Row 0: Top perimeter (all walls)
    [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],

    // Rows 1-4: Open ground with left/right perimeter walls
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],

    // Row 5: Building top edge (x: 5-9 are walls)
    [W, G, G, G, G, W, W, W, W, W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],

    // Row 6: Building left/right walls (x: 5 and 9 are walls, 6-8 are ground interior)
    [W, G, G, G, G, W, G, G, G, W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],

    // Row 7: Building left/right walls (x: 5 and 9 are walls, 6-8 are ground interior)
    [W, G, G, G, G, W, G, G, G, W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],

    // Row 8: Building bottom edge (x: 5-9 are walls)
    [W, G, G, G, G, W, W, W, W, W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],

    // Row 9: Open ground with scattered rocks starting
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W, G, G, G, G, G, G, G, G, G, G, W],

    // Row 10: Scattered rocks (walls) near x=20
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W, G, W, G, G, G, G, G, G, G, G, W],

    // Row 11: More scattered rocks
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W, G, G, G, G, G, G, G, G, G, W],

    // Rows 12-18: Open ground
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W], // Row 16 (spawn row)
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],

    // Row 19: Water pond starts (x: 24-26)
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, T, T, T, G, G, G, G, W],

    // Row 20: Water pond middle (x: 24-26)
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, T, T, T, G, G, G, G, W],

    // Row 21: Water pond bottom (x: 24-26)
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, T, T, T, G, G, G, G, W],

    // Rows 22-30: Open ground
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],
    [W, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, W],

    // Row 31: Bottom perimeter (all walls)
    [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  ],
};

// Sanity checks - these will throw at module load time if the map is invalid
if (TOWN_MAP.tiles.length !== TOWN_MAP.height) {
  throw new Error('Map height mismatch');
}
if (TOWN_MAP.tiles[0]!.length !== TOWN_MAP.width) {
  throw new Error('Map width mismatch');
}
if (TOWN_MAP.tiles[TOWN_MAP.spawnY]![TOWN_MAP.spawnX] !== TileType.GROUND) {
  throw new Error('Spawn point is not on ground');
}
