/**
 * Integration tests for WorldPersistence service.
 * Tests run against the ruin_test database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { runMigrations } from '../src/db/migrate.js';
import {
  createWorld,
  getWorld,
  listWorldsByOwner,
  deleteWorld,
  createCharacter,
  getCharacter,
  saveAll,
} from '../src/persistence/WorldPersistence.js';

const { Pool } = pg;

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://ruin:ruin@localhost:5432/ruin_test';

let testPool: pg.Pool;

beforeAll(async () => {
  testPool = new Pool({ connectionString: TEST_DATABASE_URL });

  try {
    await testPool.query('SELECT 1');
  } catch {
    throw new Error(
      'Test database ruin_test is not available. Start Docker with: docker compose up -d',
    );
  }

  await runMigrations(testPool);
});

beforeEach(async () => {
  await testPool.query(
    'TRUNCATE game_events, npcs, characters, world_saves, accounts CASCADE',
  );
});

afterAll(async () => {
  await testPool.end();
});

/**
 * Creates a test account directly in the DB (bypasses auth routes for speed).
 */
async function createTestAccount(email: string): Promise<string> {
  const result = await testPool.query<{ id: string }>(
    "INSERT INTO accounts (email, password_hash) VALUES ($1, 'test_hash') RETURNING id",
    [email],
  );
  return result.rows[0]!.id;
}

describe('createWorld', () => {
  it('returns a valid WorldSaveRow with correct owner_id, name, and seed', async () => {
    const accountId = await createTestAccount('owner@test.com');
    const world = await createWorld(testPool, accountId, 'Test World');

    expect(world.id).toBeDefined();
    expect(world.owner_id).toBe(accountId);
    expect(world.name).toBe('Test World');
    expect(world.seed).toBeDefined();
    expect(Number(world.seed)).toBeGreaterThan(0);
    expect(world.world_data).toMatchObject({ mapId: 'town' });
    expect(world.created_at).toBeInstanceOf(Date);
    expect(world.updated_at).toBeInstanceOf(Date);
  });
});

describe('getWorld', () => {
  it('returns the world row when found', async () => {
    const accountId = await createTestAccount('owner2@test.com');
    const created = await createWorld(testPool, accountId, 'My World');

    const found = await getWorld(testPool, created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.name).toBe('My World');
  });

  it('returns null for a nonexistent UUID', async () => {
    const result = await getWorld(testPool, '00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });
});

describe('listWorldsByOwner', () => {
  it('returns only worlds owned by the specified account, ordered by updated_at DESC', async () => {
    const owner1 = await createTestAccount('list1@test.com');
    const owner2 = await createTestAccount('list2@test.com');

    const w1 = await createWorld(testPool, owner1, 'Alpha');
    // Small delay to ensure updated_at ordering is deterministic
    await new Promise((r) => setTimeout(r, 10));
    const w2 = await createWorld(testPool, owner1, 'Beta');
    await createWorld(testPool, owner2, 'Other'); // should not appear

    const worlds = await listWorldsByOwner(testPool, owner1);
    expect(worlds).toHaveLength(2);
    // Most recently updated first
    expect(worlds[0]!.id).toBe(w2.id);
    expect(worlds[1]!.id).toBe(w1.id);
  });
});

describe('deleteWorld', () => {
  it('deletes an owned world and returns true', async () => {
    const accountId = await createTestAccount('del1@test.com');
    const world = await createWorld(testPool, accountId, 'To Delete');

    const deleted = await deleteWorld(testPool, world.id, accountId);
    expect(deleted).toBe(true);

    const found = await getWorld(testPool, world.id);
    expect(found).toBeNull();
  });

  it('returns false when trying to delete another account\'s world', async () => {
    const owner = await createTestAccount('del2@test.com');
    const other = await createTestAccount('del3@test.com');
    const world = await createWorld(testPool, owner, 'Protected');

    const deleted = await deleteWorld(testPool, world.id, other);
    expect(deleted).toBe(false);

    // World should still exist
    const found = await getWorld(testPool, world.id);
    expect(found).not.toBeNull();
  });

  it('returns false for a nonexistent world', async () => {
    const accountId = await createTestAccount('del4@test.com');
    const deleted = await deleteWorld(
      testPool,
      '00000000-0000-0000-0000-000000000000',
      accountId,
    );
    expect(deleted).toBe(false);
  });
});

describe('createCharacter', () => {
  it('creates a character with correct position and name', async () => {
    const accountId = await createTestAccount('char1@test.com');
    const world = await createWorld(testPool, accountId, 'World A');

    const char = await createCharacter(testPool, accountId, world.id, 'Hero', 10, 20);
    expect(char.id).toBeDefined();
    expect(char.account_id).toBe(accountId);
    expect(char.world_id).toBe(world.id);
    expect(char.name).toBe('Hero');
    expect(char.position_x).toBe(10);
    expect(char.position_y).toBe(20);
  });

  it('enforces UNIQUE(account_id, world_id) — second insert throws', async () => {
    const accountId = await createTestAccount('char2@test.com');
    const world = await createWorld(testPool, accountId, 'World B');

    await createCharacter(testPool, accountId, world.id, 'First', 0, 0);
    await expect(
      createCharacter(testPool, accountId, world.id, 'Second', 5, 5),
    ).rejects.toThrow();
  });
});

describe('getCharacter', () => {
  it('returns the character for a given account + world pair', async () => {
    const accountId = await createTestAccount('gc1@test.com');
    const world = await createWorld(testPool, accountId, 'World C');
    await createCharacter(testPool, accountId, world.id, 'Ranger', 3, 7);

    const found = await getCharacter(testPool, accountId, world.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Ranger');
    expect(found!.position_x).toBe(3);
    expect(found!.position_y).toBe(7);
  });

  it('returns null for a nonexistent account + world pair', async () => {
    const result = await getCharacter(
      testPool,
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
    );
    expect(result).toBeNull();
  });
});

describe('saveAll', () => {
  it('updates world_data and character positions in a single transaction', async () => {
    const accountId = await createTestAccount('save1@test.com');
    const world = await createWorld(testPool, accountId, 'Save World');

    const account2 = await createTestAccount('save2@test.com');
    const char1 = await createCharacter(testPool, accountId, world.id, 'One', 1, 1);
    const char2 = await createCharacter(testPool, account2, world.id, 'Two', 2, 2);

    const newWorldData = { mapId: 'town', version: 2 };
    await saveAll(testPool, world.id, newWorldData, [
      { characterId: char1.id, x: 10, y: 11 },
      { characterId: char2.id, x: 20, y: 21 },
    ]);

    // Verify world_data updated
    const updatedWorld = await getWorld(testPool, world.id);
    expect(updatedWorld!.world_data).toMatchObject({ mapId: 'town', version: 2 });

    // Verify character positions updated
    const updatedChar1 = await getCharacter(testPool, accountId, world.id);
    expect(updatedChar1!.position_x).toBe(10);
    expect(updatedChar1!.position_y).toBe(11);

    const updatedChar2 = await getCharacter(testPool, account2, world.id);
    expect(updatedChar2!.position_x).toBe(20);
    expect(updatedChar2!.position_y).toBe(21);
  });

  it('updates world_data with empty characters array without error', async () => {
    const accountId = await createTestAccount('save3@test.com');
    const world = await createWorld(testPool, accountId, 'Empty Save World');

    await expect(
      saveAll(testPool, world.id, { mapId: 'town', empty: true }, []),
    ).resolves.toBeUndefined();

    const updatedWorld = await getWorld(testPool, world.id);
    expect(updatedWorld!.world_data).toMatchObject({ mapId: 'town', empty: true });
  });
});
