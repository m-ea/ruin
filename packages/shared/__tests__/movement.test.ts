import { describe, it, expect } from 'vitest';
import { tryMove, processPlayerInput } from '../src/movement/movement.js';
import { Direction } from '../src/types/input.js';
import { TileType, type GameMap } from '../src/types/map.js';
import { TOWN_MAP } from '../src/maps/town.js';

/**
 * Small 5x5 test map for isolated movement testing.
 *
 * Layout (tiles[y][x]):
 *   x: 0     1     2     3     4
 * y=0: WALL  WALL  WALL  WALL  WALL
 * y=1: WALL  GND   GND   GND   WALL
 * y=2: WALL  GND   GND   GND   WALL
 * y=3: WALL  GND   WATER GND   WALL
 * y=4: WALL  WALL  WALL  WALL  WALL
 */
const TEST_MAP: GameMap = {
  width: 5,
  height: 5,
  spawnX: 2,
  spawnY: 2,
  tiles: [
    [TileType.WALL, TileType.WALL,   TileType.WALL,  TileType.WALL, TileType.WALL],
    [TileType.WALL, TileType.GROUND, TileType.GROUND, TileType.GROUND, TileType.WALL],
    [TileType.WALL, TileType.GROUND, TileType.GROUND, TileType.GROUND, TileType.WALL],
    [TileType.WALL, TileType.GROUND, TileType.WATER,  TileType.GROUND, TileType.WALL],
    [TileType.WALL, TileType.WALL,   TileType.WALL,  TileType.WALL, TileType.WALL],
  ],
};

describe('tryMove', () => {
  it('moves UP onto ground', () => {
    // (2,2) UP → (2,1) tiles[1][2] = GROUND
    const result = tryMove(TEST_MAP, 2, 2, Direction.UP);
    expect(result).toEqual({ x: 2, y: 1, moved: true });
  });

  it('blocks move DOWN into water', () => {
    // (2,2) DOWN → (2,3) tiles[3][2] = WATER — non-passable
    const result = tryMove(TEST_MAP, 2, 2, Direction.DOWN);
    expect(result).toEqual({ x: 2, y: 2, moved: false });
  });

  it('moves LEFT onto ground', () => {
    // (2,2) LEFT → (1,2) tiles[2][1] = GROUND
    const result = tryMove(TEST_MAP, 2, 2, Direction.LEFT);
    expect(result).toEqual({ x: 1, y: 2, moved: true });
  });

  it('moves RIGHT onto ground', () => {
    // (2,2) RIGHT → (3,2) tiles[2][3] = GROUND
    const result = tryMove(TEST_MAP, 2, 2, Direction.RIGHT);
    expect(result).toEqual({ x: 3, y: 2, moved: true });
  });

  it('blocks move UP into wall', () => {
    // (2,1) UP → (2,0) tiles[0][2] = WALL
    const result = tryMove(TEST_MAP, 2, 1, Direction.UP);
    expect(result).toEqual({ x: 2, y: 1, moved: false });
  });

  it('blocks move LEFT into wall', () => {
    // (1,2) LEFT → (0,2) tiles[2][0] = WALL
    const result = tryMove(TEST_MAP, 1, 2, Direction.LEFT);
    expect(result).toEqual({ x: 1, y: 2, moved: false });
  });

  it('blocks move RIGHT into wall', () => {
    // (3,2) RIGHT → (4,2) tiles[2][4] = WALL
    const result = tryMove(TEST_MAP, 3, 2, Direction.RIGHT);
    expect(result).toEqual({ x: 3, y: 2, moved: false });
  });
});

describe('processPlayerInput', () => {
  it('delegates to tryMove — same inputs produce same output', () => {
    const tryResult = tryMove(TEST_MAP, 2, 2, Direction.UP);
    const processResult = processPlayerInput(TEST_MAP, 2, 2, Direction.UP);
    expect(processResult).toEqual(tryResult);
  });
});

describe('TOWN_MAP sanity', () => {
  it('has correct dimensions and valid spawn point', () => {
    expect(TOWN_MAP.width).toBe(32);
    expect(TOWN_MAP.height).toBe(32);
    expect(TOWN_MAP.tiles.length).toBe(32);
    expect(TOWN_MAP.tiles[0]!.length).toBe(32);

    // Spawn must be on ground
    const spawnTile = TOWN_MAP.tiles[TOWN_MAP.spawnY]![TOWN_MAP.spawnX]!;
    expect(spawnTile).toBe(TileType.GROUND);
  });

  it('has walls on entire perimeter', () => {
    for (let x = 0; x < 32; x++) {
      expect(TOWN_MAP.tiles[0]![x]).toBe(TileType.WALL);   // top row
      expect(TOWN_MAP.tiles[31]![x]).toBe(TileType.WALL);  // bottom row
    }
    for (let y = 0; y < 32; y++) {
      expect(TOWN_MAP.tiles[y]![0]).toBe(TileType.WALL);   // left column
      expect(TOWN_MAP.tiles[y]![31]).toBe(TileType.WALL);  // right column
    }
  });
});

describe('bounds rejection', () => {
  it('rejects move out of bounds (independent of tile content)', () => {
    // From (0,0) move LEFT → target (-1, 0) — out of bounds
    const result = tryMove(TEST_MAP, 0, 0, Direction.LEFT);
    expect(result).toEqual({ x: 0, y: 0, moved: false });
  });
});
