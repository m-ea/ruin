/**
 * WorldPersistence — Pure async functions for world and character DB operations.
 *
 * Each function accepts a Pool parameter for testability — tests pass their own
 * pool connected to ruin_test; production code passes the singleton pool.
 */

import type { Pool } from 'pg';
import {
  DEFAULT_WORLD_DATA,
  createDefaultStats,
  createDefaultBodyHealth,
  type Stats,
  type BodyHealth,
} from '@ruin/shared';

export interface WorldSaveRow {
  id: string;
  owner_id: string;
  name: string;
  seed: number;
  world_data: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface CharacterRow {
  id: string;
  account_id: string;
  world_id: string;
  name: string;
  position_x: number;
  position_y: number;
  /**
   * Unlike world_data (deliberately generic/evolving, hence Record<string, unknown>),
   * stats/body_health have a fully specified shape — typed strongly rather than loosely.
   * pg parses JSONB columns into plain JS objects automatically on SELECT.
   */
  stats: Stats;
  body_health: BodyHealth;
  created_at: Date;
  updated_at: Date;
}

export interface CharacterSaveData {
  characterId: string;
  x: number;
  y: number;
}

/**
 * Creates a new world save owned by the given account.
 */
export async function createWorld(
  pool: Pool,
  ownerId: string,
  name: string,
): Promise<WorldSaveRow> {
  const seed = Math.floor(Math.random() * 2 ** 32);
  const result = await pool.query<WorldSaveRow>(
    `INSERT INTO world_saves (owner_id, name, seed, world_data)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [ownerId, name, seed, JSON.stringify(DEFAULT_WORLD_DATA)],
  );
  return result.rows[0]!;
}

/**
 * Returns a world save by ID, or null if not found.
 */
export async function getWorld(
  pool: Pool,
  worldId: string,
): Promise<WorldSaveRow | null> {
  const result = await pool.query<WorldSaveRow>(
    'SELECT * FROM world_saves WHERE id = $1',
    [worldId],
  );
  return result.rows[0] ?? null;
}

/**
 * Returns all world saves owned by the given account, ordered by updated_at DESC.
 */
export async function listWorldsByOwner(
  pool: Pool,
  ownerId: string,
): Promise<WorldSaveRow[]> {
  const result = await pool.query<WorldSaveRow>(
    'SELECT * FROM world_saves WHERE owner_id = $1 ORDER BY updated_at DESC',
    [ownerId],
  );
  return result.rows;
}

/**
 * Deletes a world save if it belongs to the given owner.
 * Returns true if a row was deleted, false otherwise.
 * Parameter order: worldId first, ownerId second.
 */
export async function deleteWorld(
  pool: Pool,
  worldId: string,
  ownerId: string,
): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM world_saves WHERE id = $1 AND owner_id = $2',
    [worldId, ownerId],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Returns the character for a given account + world pair, or null if not found.
 *
 * Note: rows created before stats/body_health were populated (column default '{}')
 * will deserialize with those fields empty rather than matching CharacterRow's
 * strong typing. No real user data exists yet — reset/truncate the local dev
 * database's characters table after this change lands, before manual testing.
 */
export async function getCharacter(
  pool: Pool,
  accountId: string,
  worldId: string,
): Promise<CharacterRow | null> {
  const result = await pool.query<CharacterRow>(
    'SELECT * FROM characters WHERE account_id = $1 AND world_id = $2',
    [accountId, worldId],
  );
  return result.rows[0] ?? null;
}

/**
 * Creates a new character for the given account + world at the given spawn position.
 */
export async function createCharacter(
  pool: Pool,
  accountId: string,
  worldId: string,
  name: string,
  spawnX: number,
  spawnY: number,
): Promise<CharacterRow> {
  const stats = createDefaultStats();
  const bodyHealth = createDefaultBodyHealth(stats.health.max);

  const result = await pool.query<CharacterRow>(
    `INSERT INTO characters (account_id, world_id, name, position_x, position_y, stats, body_health)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      accountId,
      worldId,
      name,
      spawnX,
      spawnY,
      JSON.stringify(stats),
      JSON.stringify(bodyHealth),
    ],
  );
  return result.rows[0]!;
}

/**
 * Saves world_data and all character positions in a single transaction.
 * If characters array is empty, only the world_data update runs.
 *
 * IMPORTANT: worldData is JSON.stringify'd before being passed to Postgres.
 * node-postgres does NOT auto-serialize objects to JSONB.
 */
export async function saveAll(
  pool: Pool,
  worldId: string,
  worldData: Record<string, unknown>,
  characters: CharacterSaveData[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE world_saves SET world_data = $2, updated_at = NOW() WHERE id = $1',
      [worldId, JSON.stringify(worldData)],
    );

    for (const char of characters) {
      await client.query(
        `UPDATE characters
         SET position_x = $2, position_y = $3, updated_at = NOW()
         WHERE id = $1 AND world_id = $4`,
        [char.characterId, char.x, char.y, worldId],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
