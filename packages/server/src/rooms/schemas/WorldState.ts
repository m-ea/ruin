/**
 * Colyseus state schemas for the WorldRoom.
 * These schemas define the synchronized state structure that is replicated to all clients.
 */

import { Schema, MapSchema, type } from '@colyseus/schema';

/**
 * PlayerState represents a single player in the world.
 * This state is synchronized to all clients in the room.
 */
export class PlayerState extends Schema {
  /** Unique session identifier assigned by Colyseus */
  @type('string') sessionId: string = '';

  /** Player display name (character name from DB) */
  @type('string') name: string = '';

  /** Account ID of the player who owns this character (used for hosting model in Phase 2b) */
  @type('string') accountId: string = '';

  /** Tile coordinate X position */
  @type('number') x: number = 0;

  /** Tile coordinate Y position */
  @type('number') y: number = 0;

  /** Last input sequence number processed by the server (0 = none yet) */
  @type('number') lastProcessedSequenceNumber: number = 0;
}

/**
 * WorldState represents the complete synchronized state for a WorldRoom.
 * Each WorldRoom corresponds to a single persistent world save.
 */
export class WorldState extends Schema {
  /**
   * Map of all active players in this world, keyed by sessionId.
   * MapSchema provides efficient synchronization of added/removed/changed players.
   */
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
