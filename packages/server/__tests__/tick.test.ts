import { describe, it, expect } from 'vitest';
import {
  processPlayerInput,
  Direction,
  type InputMessage,
  type GameMap,
  TOWN_MAP,
} from '@ruin/shared';

/**
 * Simulates one tick of input processing for a single player.
 * Mirrors the logic in WorldRoom.tick() but as a pure function.
 */
function simulateTick(
  playerX: number,
  playerY: number,
  lastSeq: number,
  inputQueue: InputMessage[],
  map: GameMap,
): { x: number; y: number; lastProcessedSequenceNumber: number; remainingQueue: InputMessage[] } {
  if (inputQueue.length === 0) {
    return { x: playerX, y: playerY, lastProcessedSequenceNumber: lastSeq, remainingQueue: [] };
  }
  const [input, ...rest] = inputQueue;
  const result = processPlayerInput(map, playerX, playerY, input!.direction);
  return {
    x: result.x,
    y: result.y,
    lastProcessedSequenceNumber: input!.sequenceNumber,
    remainingQueue: rest,
  };
}

describe('tick processing', () => {
  it('does nothing with empty input queue', () => {
    const result = simulateTick(16, 16, 0, [], TOWN_MAP);
    expect(result).toEqual({
      x: 16,
      y: 16,
      lastProcessedSequenceNumber: 0,
      remainingQueue: [],
    });
  });

  it('processes a single valid move', () => {
    const queue: InputMessage[] = [{ sequenceNumber: 1, direction: Direction.RIGHT }];
    const result = simulateTick(16, 16, 0, queue, TOWN_MAP);
    expect(result.x).toBe(17);
    expect(result.y).toBe(16);
    expect(result.lastProcessedSequenceNumber).toBe(1);
    expect(result.remainingQueue).toHaveLength(0);
  });

  it('updates sequence number even on blocked move', () => {
    // Move into top-left wall: (1,1) UP → (1,0) which is WALL
    const queue: InputMessage[] = [{ sequenceNumber: 5, direction: Direction.UP }];
    const result = simulateTick(1, 1, 4, queue, TOWN_MAP);
    expect(result.x).toBe(1);
    expect(result.y).toBe(1); // Position unchanged (wall)
    expect(result.lastProcessedSequenceNumber).toBe(5); // Seq STILL updates
  });

  it('processes only first input when multiple are queued', () => {
    const queue: InputMessage[] = [
      { sequenceNumber: 1, direction: Direction.RIGHT },
      { sequenceNumber: 2, direction: Direction.DOWN },
      { sequenceNumber: 3, direction: Direction.LEFT },
    ];
    const result = simulateTick(16, 16, 0, queue, TOWN_MAP);
    expect(result.x).toBe(17);
    expect(result.y).toBe(16);
    expect(result.lastProcessedSequenceNumber).toBe(1);
    expect(result.remainingQueue).toHaveLength(2);
    expect(result.remainingQueue[0]!.sequenceNumber).toBe(2);
    expect(result.remainingQueue[1]!.sequenceNumber).toBe(3);
  });

  it('updates sequence numbers correctly across multiple ticks', () => {
    const queue: InputMessage[] = [
      { sequenceNumber: 1, direction: Direction.RIGHT },
      { sequenceNumber: 2, direction: Direction.RIGHT },
      { sequenceNumber: 3, direction: Direction.DOWN },
    ];

    // Tick 1: process seq 1, move right from spawn (16,16) → (17,16)
    const tick1 = simulateTick(16, 16, 0, queue, TOWN_MAP);
    expect(tick1.x).toBe(17);
    expect(tick1.lastProcessedSequenceNumber).toBe(1);

    // Tick 2: process seq 2, move right from (17,16) → (18,16)
    const tick2 = simulateTick(tick1.x, tick1.y, tick1.lastProcessedSequenceNumber, tick1.remainingQueue, TOWN_MAP);
    expect(tick2.x).toBe(18);
    expect(tick2.lastProcessedSequenceNumber).toBe(2);

    // Tick 3: process seq 3, move down from (18,16) → (18,17)
    const tick3 = simulateTick(tick2.x, tick2.y, tick2.lastProcessedSequenceNumber, tick2.remainingQueue, TOWN_MAP);
    expect(tick3.x).toBe(18);
    expect(tick3.y).toBe(17);
    expect(tick3.lastProcessedSequenceNumber).toBe(3);
    expect(tick3.remainingQueue).toHaveLength(0);
  });

  it('handles all four directions from spawn point', () => {
    // Spawn is (16, 16) — all adjacent tiles should be GROUND in TOWN_MAP
    const up = simulateTick(16, 16, 0, [{ sequenceNumber: 1, direction: Direction.UP }], TOWN_MAP);
    expect(up).toMatchObject({ x: 16, y: 15, lastProcessedSequenceNumber: 1 });

    const down = simulateTick(16, 16, 0, [{ sequenceNumber: 1, direction: Direction.DOWN }], TOWN_MAP);
    expect(down).toMatchObject({ x: 16, y: 17, lastProcessedSequenceNumber: 1 });

    const left = simulateTick(16, 16, 0, [{ sequenceNumber: 1, direction: Direction.LEFT }], TOWN_MAP);
    expect(left).toMatchObject({ x: 15, y: 16, lastProcessedSequenceNumber: 1 });

    const right = simulateTick(16, 16, 0, [{ sequenceNumber: 1, direction: Direction.RIGHT }], TOWN_MAP);
    expect(right).toMatchObject({ x: 17, y: 16, lastProcessedSequenceNumber: 1 });
  });

  it('allows two players on the same tile (no player-to-player collision)', () => {
    // Both players start at spawn (16,16) and move RIGHT
    const queue: InputMessage[] = [{ sequenceNumber: 1, direction: Direction.RIGHT }];

    const player1 = simulateTick(16, 16, 0, [...queue], TOWN_MAP);
    const player2 = simulateTick(16, 16, 0, [...queue], TOWN_MAP);

    // Both should end at (17,16) — no collision blocking
    expect(player1.x).toBe(17);
    expect(player1.y).toBe(16);
    expect(player2.x).toBe(17);
    expect(player2.y).toBe(16);
  });
});
