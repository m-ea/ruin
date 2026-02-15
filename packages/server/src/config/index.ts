/**
 * Server configuration module.
 * Loads environment variables and validates required settings.
 * This module is imported early in the application lifecycle.
 */

import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Get the project root directory (4 levels up from this file: src/config → src → server → packages → root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../../../..');

// Load .env from project root
dotenvConfig({ path: resolve(projectRoot, '.env') });

// Validate required environment variables before creating config
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Application configuration derived from environment variables.
 * All required fields are validated and guaranteed to be non-null.
 */
export const config = {
  /** Server port (default: 2567) */
  port: parseInt(process.env.PORT ?? '2567', 10),

  /** PostgreSQL connection string (validated as non-null) */
  databaseUrl: process.env.DATABASE_URL as string,

  /** JWT signing secret (validated as non-null) */
  jwtSecret: process.env.JWT_SECRET as string,

  /** Logging level (default: 'info') */
  logLevel: process.env.LOG_LEVEL ?? 'info',

  /** Node environment (default: 'development') */
  nodeEnv: process.env.NODE_ENV ?? 'development',

  /** Admin password for monitoring dashboard (default: 'admin', dev-only) */
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin',
};

// Warn about insecure JWT secret in non-production environments
if (
  config.jwtSecret === 'change-me-in-production' &&
  config.nodeEnv === 'production'
) {
  throw new Error(
    'JWT_SECRET must be changed from default value in production environment',
  );
}

if (
  config.jwtSecret === 'change-me-in-production' &&
  config.nodeEnv !== 'production'
) {
  console.warn(
    'WARNING: Using default JWT_SECRET. Change this before deploying to production!',
  );
}
