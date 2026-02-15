/**
 * Integration tests for authentication endpoints.
 * Tests register and login functionality against a real test database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { Server } from 'http';
import { createApp } from '../src/index.js';
import { runMigrations } from '../src/db/migrate.js';

const { Pool } = pg;

// Test database configuration
const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://ruin:ruin@localhost:5432/ruin_test';

let testPool: pg.Pool;
let server: Server;
let baseUrl: string;

/**
 * Setup: Create test pool, run migrations, start server on random port
 */
beforeAll(async () => {
  // Create test database pool
  testPool = new Pool({
    connectionString: TEST_DATABASE_URL,
  });

  // Test database connection
  try {
    await testPool.query('SELECT 1');
  } catch (err) {
    throw new Error(
      'Test database ruin_test is not available. Create it with: createdb ruin_test',
    );
  }

  // Run migrations on test database
  await runMigrations(testPool);

  // Create and start server on random port
  const app = createApp(testPool);
  server = app.listen(0); // Port 0 = random available port

  // Get the assigned port
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to get server port');
  }
  const port = address.port;
  baseUrl = `http://localhost:${port}`;
});

/**
 * Cleanup: Truncate tables, close pool, close server
 */
afterAll(async () => {
  // Truncate all tables in reverse dependency order
  await testPool.query(
    'TRUNCATE game_events, npcs, characters, world_saves, accounts CASCADE',
  );

  // Close pool and server
  await testPool.end();
  server.close();
});

describe('POST /auth/register', () => {
  it('should register a new user successfully', async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test1@example.com',
        password: 'password123',
      }),
    });

    expect(response.status).toBe(201);

    const data = (await response.json()) as { token: string; accountId: string };
    expect(data.token).toBeDefined();
    expect(data.accountId).toBeDefined();
    expect(typeof data.token).toBe('string');
    expect(typeof data.accountId).toBe('string');
  });

  it('should return 409 for duplicate email', async () => {
    // Register first user
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test2@example.com',
        password: 'password123',
      }),
    });

    // Try to register again with same email
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test2@example.com',
        password: 'password456',
      }),
    });

    expect(response.status).toBe(409);

    const data = (await response.json()) as { error: string; code: string };
    expect(data.code).toBe('CONFLICT');
  });

  it('should return 400 for password too short', async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test3@example.com',
        password: 'short',
      }),
    });

    expect(response.status).toBe(400);

    const data = (await response.json()) as { error: string; code: string };
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid email', async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'password123',
      }),
    });

    expect(response.status).toBe(400);

    const data = (await response.json()) as { error: string; code: string };
    expect(data.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/login', () => {
  it('should login successfully with correct credentials', async () => {
    // Register a user first
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test4@example.com',
        password: 'password123',
      }),
    });

    // Login with correct credentials
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test4@example.com',
        password: 'password123',
      }),
    });

    expect(response.status).toBe(200);

    const data = (await response.json()) as { token: string; accountId: string };
    expect(data.token).toBeDefined();
    expect(data.accountId).toBeDefined();
  });

  it('should return 401 for wrong password', async () => {
    // Register a user first
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test5@example.com',
        password: 'password123',
      }),
    });

    // Login with wrong password
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test5@example.com',
        password: 'wrongpassword',
      }),
    });

    expect(response.status).toBe(401);

    const data = (await response.json()) as { error: string; code: string };
    expect(data.code).toBe('AUTH_FAILED');
  });

  it('should return 401 for nonexistent email', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'password123',
      }),
    });

    expect(response.status).toBe(401);

    const data = (await response.json()) as { error: string; code: string };
    expect(data.code).toBe('AUTH_FAILED');
  });
});
