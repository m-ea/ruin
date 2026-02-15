/**
 * Server entry point.
 * Exports createApp and createGameServer for testing, and runs startup code when executed directly.
 */

import http from 'node:http';
import express, { Express, Request, Response } from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { monitor } from '@colyseus/monitor';
import { Pool } from 'pg';
import { config } from './config/index.js';
import { logger } from './logging/logger.js';
import { correlationIdMiddleware } from './logging/correlationId.js';
import { pool, testConnection } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import authRoutes from './auth/routes.js';
import { WorldRoom } from './rooms/WorldRoom.js';

/**
 * Creates and configures the Express application.
 * Does not start the server - returns the configured app for testing or manual startup.
 *
 * @param dbPool - PostgreSQL connection pool
 * @returns Configured Express application
 */
export function createApp(dbPool: Pool): Express {
  const app = express();

  // Parse JSON request bodies
  app.use(express.json());

  // Attach correlation ID middleware for request tracing
  app.use(correlationIdMiddleware);

  // Mount auth routes
  app.use('/auth', authRoutes);

  return app;
}

/**
 * Creates and configures the Colyseus game server.
 * Wraps the Express app with Colyseus and registers game rooms.
 *
 * @param app - Configured Express application
 * @returns Configured Colyseus Server instance
 */
export function createGameServer(app: Express): Server {
  // Create HTTP server from Express app
  const httpServer = http.createServer(app);

  // Create Colyseus server with WebSocket transport
  const gameServer = new Server({
    transport: new WebSocketTransport({
      server: httpServer,
    }),
  });

  // Register WorldRoom
  gameServer.define('world', WorldRoom);

  // Attach Colyseus monitoring dashboard at GET /colyseus
  // Dev-only auth — replace with proper auth for production
  app.use(
    '/colyseus',
    (req: Request, res: Response, next) => {
      // Check password via query parameter
      if (req.query.password !== config.adminPassword) {
        res.status(401).send('Unauthorized');
        return;
      }
      next();
    },
    monitor(),
  );

  return gameServer;
}

/**
 * Startup code - only runs when this file is executed directly (not imported).
 * Tests database connection, runs migrations, and starts the server.
 */
import { fileURLToPath } from 'node:url';
import { normalize } from 'node:path';

const currentFile = normalize(fileURLToPath(import.meta.url));
const mainFile = process.argv[1] ? normalize(process.argv[1]) : '';
const isMainModule = currentFile === mainFile;

if (isMainModule) {
  (async () => {
    try {
      // Test database connection
      logger.info('Testing database connection...');
      await testConnection();

      // Run pending migrations
      logger.info('Running migrations...');
      await runMigrations(pool);

      // Create Express app
      const app = createApp(pool);

      // Create Colyseus game server (wraps Express app with HTTP server)
      const gameServer = createGameServer(app);

      // Start server - gameServer.listen() is the ONLY listen() call
      gameServer.listen(config.port);
      logger.info({ port: config.port }, 'Server started (Express + Colyseus)');
    } catch (err) {
      logger.error({ err }, 'Server startup failed');
      process.exit(1);
    }
  })();
}
