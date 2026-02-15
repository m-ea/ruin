/**
 * PostgreSQL connection pool.
 * Provides a singleton Pool instance for database queries.
 */

import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../logging/logger.js';

const { Pool } = pg;

/**
 * Global PostgreSQL connection pool.
 * Configured from DATABASE_URL environment variable.
 */
export const pool = new Pool({
  connectionString: config.databaseUrl,
});

// Log pool errors
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

/**
 * Tests the database connection by running a simple query.
 * Throws an error if the connection fails.
 */
export async function testConnection(): Promise<void> {
  try {
    await pool.query('SELECT 1');
    logger.info('Database connection test successful');
  } catch (err) {
    logger.error({ err }, 'Database connection test failed');
    throw err;
  }
}
