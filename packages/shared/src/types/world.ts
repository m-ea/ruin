/**
 * World save interface representing a persistent game world.
 * Each world can be joined by multiple players for cooperative play.
 */
export interface IWorldSave {
  /** Unique identifier (UUID) */
  id: string;

  /** Account ID of the world owner */
  ownerId: string;

  /** Human-readable world name */
  name: string;

  /** World generation seed for procedural content */
  seed: number;

  /** Arbitrary world state data (tiles, structures, etc.) */
  worldData: Record<string, unknown>;

  /** Last time the world simulation was updated */
  lastSimulatedAt: Date;
}
