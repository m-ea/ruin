/**
 * Colyseus state schemas for the WorldRoom.
 * These schemas define the synchronized state structure that is replicated to all clients.
 */

import { Schema, MapSchema, type } from '@colyseus/schema';

/**
 * A bounded numeric quantity: a current value that can never exceed max.
 * Standalone/reusable — not fields hardcoded directly onto PlayerState — so a
 * future entity schema (e.g. an NPC) can embed StatsSchema/BodyHealthSchema too.
 */
export class ResourceSchema extends Schema {
  @type('number') current: number = 100;
  @type('number') max: number = 100;
}

/** Top-level character stats: health, stamina, essence. */
export class StatsSchema extends Schema {
  @type(ResourceSchema) health = new ResourceSchema();
  @type(ResourceSchema) stamina = new ResourceSchema();
  @type(ResourceSchema) essence = new ResourceSchema();
}

/** Per-body-part health tracking. */
export class BodyHealthSchema extends Schema {
  @type(ResourceSchema) head = new ResourceSchema();
  @type(ResourceSchema) torso = new ResourceSchema();
  @type(ResourceSchema) leftArm = new ResourceSchema();
  @type(ResourceSchema) rightArm = new ResourceSchema();
  @type(ResourceSchema) leftLeg = new ResourceSchema();
  @type(ResourceSchema) rightLeg = new ResourceSchema();
}

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

  /** Character stats: health, stamina, essence */
  @type(StatsSchema) stats = new StatsSchema();

  /** Per-body-part health */
  @type(BodyHealthSchema) bodyHealth = new BodyHealthSchema();
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
