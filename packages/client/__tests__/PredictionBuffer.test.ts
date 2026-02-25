import { describe, it, expect } from 'vitest';
import { PredictionBuffer } from '../src/network/PredictionBuffer';
import { Direction, TileType, type GameMap } from '@ruin/shared';

const TEST_MAP: GameMap = {
  width: 5,
  height: 5,
  spawnX: 2,
  spawnY: 2,
  tiles: [
    [TileType.WALL, TileType.WALL, TileType.WALL, TileType.WALL, TileType.WALL],
    [TileType.WALL, TileType.GROUND, TileType.GROUND, TileType.GROUND, TileType.WALL],
    [TileType.WALL, TileType.GROUND, TileType.GROUND, TileType.GROUND, TileType.WALL],
    [TileType.WALL, TileType.GROUND, TileType.WATER, TileType.GROUND, TileType.WALL],
    [TileType.WALL, TileType.WALL, TileType.WALL, TileType.WALL, TileType.WALL],
  ],
};

describe('PredictionBuffer', () => {
  it('returns server position when buffer is empty', () => {
    const buffer = new PredictionBuffer();
    const result = buffer.reconcile(2, 2, 0, TEST_MAP);
    expect(result).toEqual({ x: 2, y: 2 });
  });

  it('returns server position after single confirmed prediction', () => {
    const buffer = new PredictionBuffer();
    buffer.addPrediction({ sequenceNumber: 1, direction: Direction.RIGHT });
    // Server confirms seq 1 — prediction removed, no unconfirmed entries remain
    const result = buffer.reconcile(3, 2, 1, TEST_MAP);
    expect(result).toEqual({ x: 3, y: 2 });
    expect(buffer.size()).toBe(0);
  });

  it('replays single unconfirmed prediction from server position', () => {
    const buffer = new PredictionBuffer();
    buffer.addPrediction({ sequenceNumber: 1, direction: Direction.RIGHT });
    // Server hasn't confirmed seq 1 yet — replay RIGHT from (2,2) → (3,2)
    const result = buffer.reconcile(2, 2, 0, TEST_MAP);
    expect(result).toEqual({ x: 3, y: 2 });
    expect(buffer.size()).toBe(1);
  });

  it('removes confirmed and replays unconfirmed predictions', () => {
    const buffer = new PredictionBuffer();
    buffer.addPrediction({ sequenceNumber: 1, direction: Direction.RIGHT });
    buffer.addPrediction({ sequenceNumber: 2, direction: Direction.DOWN });
    buffer.addPrediction({ sequenceNumber: 3, direction: Direction.RIGHT });
    // Server confirms through seq 1, position (3,2)
    // Remaining: seq 2 (DOWN: (3,2)→(3,3)), seq 3 (RIGHT: (3,3)→blocked by WALL at tiles[3][4]... wait, tiles[3][4]=WALL)
    // Actually tiles[3][3]=GROUND. RIGHT from (3,3): tiles[3][4]=WALL → blocked. Stays (3,3).
    const result = buffer.reconcile(3, 2, 1, TEST_MAP);
    expect(result).toEqual({ x: 3, y: 3 });
    expect(buffer.size()).toBe(2);
  });

  it('corrects misprediction via reconciliation replay', () => {
    const buffer = new PredictionBuffer();
    // Client predicted all 3 moves RIGHT from (2,2)
    buffer.addPrediction({ sequenceNumber: 1, direction: Direction.RIGHT });
    buffer.addPrediction({ sequenceNumber: 2, direction: Direction.RIGHT });
    buffer.addPrediction({ sequenceNumber: 3, direction: Direction.RIGHT });
    // Server says after seq 1, position is still (2,2) — server rejected the move
    // Replay: seq 2 RIGHT from (2,2)→(3,2), seq 3 RIGHT from (3,2)→tiles[2][4]=WALL→blocked
    const result = buffer.reconcile(2, 2, 1, TEST_MAP);
    expect(result).toEqual({ x: 3, y: 2 });
    expect(buffer.size()).toBe(2);
  });

  it('caps buffer at MAX_SIZE (60)', () => {
    const buffer = new PredictionBuffer();
    for (let i = 1; i <= 65; i++) {
      buffer.addPrediction({ sequenceNumber: i, direction: Direction.RIGHT });
    }
    expect(buffer.size()).toBe(60);
  });

  it('clears the buffer', () => {
    const buffer = new PredictionBuffer();
    buffer.addPrediction({ sequenceNumber: 1, direction: Direction.UP });
    buffer.addPrediction({ sequenceNumber: 2, direction: Direction.DOWN });
    buffer.clear();
    expect(buffer.size()).toBe(0);
  });
});
