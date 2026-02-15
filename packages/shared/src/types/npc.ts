/**
 * NPC (Non-Player Character) interface for AI-driven entities.
 * NPCs have their own goals, relationships, and can interact with the world.
 */
export interface INpc {
  /** Unique identifier (UUID) */
  id: string;

  /** World this NPC belongs to */
  worldId: string;

  /** NPC archetype or class (e.g., 'merchant', 'guard', 'villager') */
  npcType: string;

  /** NPC's name */
  name: string;

  /** Internal NPC state (mood, current activity, etc.) */
  state: Record<string, unknown>;

  /** NPC's current goals and objectives */
  goals: unknown[];

  /** Items the NPC is carrying */
  inventory: unknown[];

  /** Relationships with other entities (player/NPC IDs mapped to affinity scores) */
  relationships: Record<string, number>;

  /** Tile coordinate X position (integer) */
  x: number;

  /** Tile coordinate Y position (integer) */
  y: number;

  /** Last time this NPC's AI was simulated */
  lastSimulatedAt: Date;
}
