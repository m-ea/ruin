import type { Stats, BodyHealth } from './character.js';

/**
 * Player character interface representing a player's state in the game.
 * Used for both in-memory state and database persistence.
 */
export interface IPlayer {
  /** Unique identifier (UUID) */
  id: string;

  /** Player character name */
  name: string;

  /** Tile coordinate X position (integer) */
  x: number;

  /** Tile coordinate Y position (integer) */
  y: number;

  /** Character stats: health, stamina, essence */
  stats: Stats;

  /** Character skills and proficiency levels */
  skills: Record<string, number>;

  /** Player inventory items */
  inventory: unknown[];

  /** Equipped items by slot */
  equipment: Record<string, unknown>;

  /** Body part health tracking */
  bodyHealth: BodyHealth;
}
