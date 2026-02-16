/**
 * Movement directions for tile-locked movement.
 */
export enum Direction {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
}

/**
 * Type guard for validating incoming direction values.
 * Used by the server to validate client input messages.
 */
export function isValidDirection(value: unknown): value is Direction {
  return typeof value === 'string' && Object.values(Direction).includes(value as Direction);
}

/**
 * Client-to-server input message.
 * Sent once per client tick (20Hz) when the player is moving.
 */
export interface InputMessage {
  /** Monotonically increasing sequence number, starting at 1. */
  sequenceNumber: number;
  /** Direction the player wants to move. */
  direction: Direction;
}
