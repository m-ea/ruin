/**
 * Database migration runner.
 * Reads .sql files from the migrations/ directory and executes them in order.
 * Tracks executed migrations in the schema_migrations table.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir, readFile } from 'fs/promises';
import pg, { Pool } from 'pg';
import { logger } from '../logging/logger.js';
import { config } from '../config/index.js';

/**
 * Parses a migration file and extracts the up migration SQL.
 * Expects exactly one "-- UP" and one "-- DOWN" marker.
 *
 * @param content - The full migration file content
 * @param filename - The migration filename (for error messages)
 * @returns The up migration SQL (trimmed)
 */
function parseUpMigration(content: string, filename: string): string {
  const upMarker = '-- UP';
  const downMarker = '-- DOWN';

  const upIndex = content.indexOf(upMarker);
  const downIndex = content.indexOf(downMarker);

  if (upIndex === -1) {
    throw new Error(`Migration ${filename} is missing "-- UP" marker`);
  }

  if (downIndex === -1) {
    throw new Error(`Migration ${filename} is missing "-- DOWN" marker`);
  }

  if (upIndex >= downIndex) {
    throw new Error(
      `Migration ${filename} has "-- UP" marker after "-- DOWN" marker`,
    );
  }

  // Extract SQL between -- UP and -- DOWN
  const upSqlStart = upIndex + upMarker.length;
  const upSql = content.slice(upSqlStart, downIndex).trim();

  return upSql;
}

/**
 * Runs all pending migrations against the database.
 * Creates the schema_migrations table if it doesn't exist.
 *
 * @param pool - PostgreSQL connection pool
 */
export async function runMigrations(pool: Pool): Promise<void> {
  logger.info('Running database migrations...');

  // Create schema_migrations table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Get the migrations directory path using import.meta.url
  const currentFileUrl = import.meta.url;
  const currentFilePath = fileURLToPath(currentFileUrl);
  const currentDir = dirname(currentFilePath);
  const migrationsDir = join(currentDir, 'migrations');

  // Read all .sql files from migrations directory
  const files = await readdir(migrationsDir);
  const migrationFiles = files.filter((f) => f.endsWith('.sql')).sort();

  if (migrationFiles.length === 0) {
    logger.info('No migration files found');
    return;
  }

  // Get already-applied migrations
  const { rows: appliedMigrations } = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename',
  );
  const appliedSet = new Set(appliedMigrations.map((r) => r.filename));

  // Run pending migrations
  for (const filename of migrationFiles) {
    if (appliedSet.has(filename)) {
      logger.debug({ filename }, 'Migration already applied, skipping');
      continue;
    }

    logger.info({ filename }, 'Applying migration');

    const filePath = join(migrationsDir, filename);
    const content = await readFile(filePath, 'utf-8');

    // Parse the up migration SQL
    const upSql = parseUpMigration(content, filename);

    // Execute migration in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(upSql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [
        filename,
      ]);
      await client.query('COMMIT');
      logger.info({ filename }, 'Migration applied successfully');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err, filename }, 'Migration failed');
      throw err;
    } finally {
      client.release();
    }
  }

  logger.info('All migrations applied successfully');
}

/**
 * Standalone execution: run migrations and exit.
 * This runs when the file is executed directly (not imported).
 */
const isMainModule =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`;

if (isMainModule) {
  // Import dotenv for standalone execution
  (async () => {
    const { default: dotenv } = await import('dotenv');
    dotenv.config();

    const standalonePool = new pg.Pool({
      connectionString: config.databaseUrl,
    });

    try {
      await runMigrations(standalonePool);
      await standalonePool.end();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Migration failed');
      await standalonePool.end();
      process.exit(1);
    }
  })();
}
