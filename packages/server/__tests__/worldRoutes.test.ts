/**
 * Integration tests for world REST routes.
 * Tests run against the ruin_test database via HTTP.
 *
 * Note: beforeEach does a full truncate + re-register to avoid interference
 * from parallel test files that also truncate accounts (CASCADE).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { Server } from 'http';
import { createApp } from '../src/index.js';
import { runMigrations } from '../src/db/migrate.js';

const { Pool } = pg;

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://ruin:ruin@localhost:5432/ruin_test';

let testPool: pg.Pool;
let server: Server;
let baseUrl: string;

// Refreshed in beforeEach to survive parallel truncations from other test files
let token: string;
let accountId: string;

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

  // Create app with test pool (includes world routes)
  const app = createApp(testPool);
  server = app.listen(0);

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to get server port');
  }
  baseUrl = `http://localhost:${address.port}`;
});

beforeEach(async () => {
  // Full truncation + re-register ensures isolation regardless of parallel test files
  await testPool.query(
    'TRUNCATE game_events, npcs, characters, world_saves, accounts CASCADE',
  );

  // Register a fresh test user
  const regResponse = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'routes@test.com', password: 'password123' }),
  });
  const regData = (await regResponse.json()) as { token: string; accountId: string };
  token = regData.token;
  accountId = regData.accountId;
});

afterAll(async () => {
  await testPool.query(
    'TRUNCATE game_events, npcs, characters, world_saves, accounts CASCADE',
  );
  await testPool.end();
  server.close();
});

describe('POST /worlds', () => {
  it('creates a world and returns 201 with world data', async () => {
    const response = await fetch(`${baseUrl}/worlds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'My World' }),
    });

    expect(response.status).toBe(201);
    const data = (await response.json()) as {
      world: { id: string; name: string; seed: unknown; createdAt: string };
    };
    expect(data.world.id).toBeDefined();
    expect(data.world.name).toBe('My World');
    expect(data.world.seed).toBeDefined();
    expect(data.world.createdAt).toBeDefined();
  });

  it('returns 400 with VALIDATION_ERROR for empty name', async () => {
    const response = await fetch(`${baseUrl}/worlds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: '   ' }),
    });

    expect(response.status).toBe(400);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without Authorization header', async () => {
    const response = await fetch(`${baseUrl}/worlds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unauthorized World' }),
    });

    expect(response.status).toBe(401);
  });
});

describe('GET /worlds', () => {
  it('returns list of worlds owned by the authenticated user', async () => {
    // Create two worlds
    await fetch(`${baseUrl}/worlds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'World One' }),
    });
    await fetch(`${baseUrl}/worlds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'World Two' }),
    });

    const response = await fetch(`${baseUrl}/worlds`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      worlds: Array<{ id: string; name: string; seed: unknown; createdAt: string; updatedAt: string }>;
    };
    expect(data.worlds).toHaveLength(2);
    expect(data.worlds.map((w) => w.name)).toContain('World One');
    expect(data.worlds.map((w) => w.name)).toContain('World Two');
  });
});

describe('GET /worlds/:id', () => {
  it('returns world details including ownerId', async () => {
    const createResponse = await fetch(`${baseUrl}/worlds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Detail World' }),
    });
    const { world: created } = (await createResponse.json()) as { world: { id: string } };

    const response = await fetch(`${baseUrl}/worlds/${created.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      world: { id: string; ownerId: string; name: string };
    };
    expect(data.world.id).toBe(created.id);
    expect(data.world.ownerId).toBe(accountId);
    expect(data.world.name).toBe('Detail World');
  });

  it('returns 404 for a nonexistent world UUID', async () => {
    const response = await fetch(
      `${baseUrl}/worlds/00000000-0000-0000-0000-000000000000`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    expect(response.status).toBe(404);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe('NOT_FOUND');
  });
});

describe('DELETE /worlds/:id', () => {
  it('deletes a world owned by the user and returns 200', async () => {
    const createResponse = await fetch(`${baseUrl}/worlds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Delete Me' }),
    });
    const { world: created } = (await createResponse.json()) as { world: { id: string } };

    const response = await fetch(`${baseUrl}/worlds/${created.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { deleted: boolean };
    expect(data.deleted).toBe(true);

    // Verify it's gone
    const checkResponse = await fetch(`${baseUrl}/worlds/${created.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(checkResponse.status).toBe(404);
  });

  it('returns 404 when a non-owner tries to delete', async () => {
    // Create a world as user1 (existing token)
    const createResponse = await fetch(`${baseUrl}/worlds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Protected World' }),
    });
    const { world: created } = (await createResponse.json()) as { world: { id: string } };

    // Register a second user
    const reg2Response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'other@test.com', password: 'password456' }),
    });
    const { token: token2 } = (await reg2Response.json()) as { token: string };

    // Try to delete as user2
    const response = await fetch(`${baseUrl}/worlds/${created.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token2}` },
    });

    expect(response.status).toBe(404);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe('NOT_FOUND');
  });
});
