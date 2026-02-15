/**
 * Authentication middleware for protected routes.
 * Verifies JWT tokens and attaches account information to requests.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt.js';

/**
 * Express middleware that validates JWT tokens from the Authorization header.
 * On success, attaches accountId and email to the request object.
 * On failure, returns a 401 Unauthorized response.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'AUTH_FAILED',
    });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const payload = verifyToken(token);

    // Attach account information to request
    req.accountId = payload.sub;
    req.email = payload.email;

    next();
  } catch (err) {
    req.log.warn({ err }, 'JWT verification failed');
    res.status(401).json({
      error: 'Unauthorized',
      code: 'AUTH_FAILED',
    });
  }
}
