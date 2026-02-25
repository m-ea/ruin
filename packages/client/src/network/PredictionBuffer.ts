import { type Direction, processPlayerInput, type GameMap } from '@ruin/shared';

interface PredictionEntry {
  sequenceNumber: number;
  direction: Direction;
}

export class PredictionBuffer {
  private buffer: PredictionEntry[] = [];
  private static readonly MAX_SIZE = 60; // ~3 seconds at 20Hz

  addPrediction(entry: PredictionEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > PredictionBuffer.MAX_SIZE) {
      this.buffer.shift();
    }
  }

  /**
   * Reconciles the client's predicted position with the server's authoritative state.
   *
   * 1. Remove all entries confirmed by the server (sequenceNumber <= serverLastProcessedSeq)
   * 2. If no unconfirmed entries remain, the server position is truth
   * 3. Otherwise, replay each unconfirmed entry's direction from the server position
   *    using the shared processPlayerInput function to produce the reconciled position
   */
  reconcile(
    serverX: number,
    serverY: number,
    serverLastProcessedSeq: number,
    map: GameMap,
  ): { x: number; y: number } {
    // Remove confirmed predictions
    this.buffer = this.buffer.filter(
      entry => entry.sequenceNumber > serverLastProcessedSeq,
    );

    if (this.buffer.length === 0) {
      return { x: serverX, y: serverY };
    }

    // Replay unconfirmed predictions from server's authoritative position
    let x = serverX;
    let y = serverY;
    for (const entry of this.buffer) {
      const result = processPlayerInput(map, x, y, entry.direction);
      x = result.x;
      y = result.y;
    }

    return { x, y };
  }

  clear(): void {
    this.buffer = [];
  }

  size(): number {
    return this.buffer.length;
  }
}
