/**
 * Correlation ID middleware for request tracing.
 * Generates a unique ID for each request and attaches a child logger with the correlation ID.
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from './logger.js';

/**
 * Express middleware that:
 * 1. Generates a unique correlation ID for each request
 * 2. Attaches the correlation ID to the request object
 * 3. Creates a child logger with the correlation ID for request-scoped logging
 * 4. Sets the X-Correlation-ID response header
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Generate unique correlation ID
  const correlationId = randomUUID();

  // Attach correlation ID to request
  req.correlationId = correlationId;

  // Create child logger with correlation ID
  req.log = logger.child({ correlationId });

  // Set response header
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}
