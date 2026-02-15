/**
 * JWT (JSON Web Token) utilities for authentication.
 * Handles token signing and verification.
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * JWT payload structure for authenticated users.
 */
export interface JwtPayload {
  /** Account ID (UUID) */
  sub: string;

  /** Account email */
  email: string;
}

/**
 * Signs a JWT token with the given payload.
 * Token expires in 7 days.
 *
 * @param payload - Token payload containing account ID and email
 * @returns Signed JWT token string
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: '7d',
  });
}

/**
 * Verifies and decodes a JWT token.
 * Throws an error if the token is invalid or expired.
 *
 * @param token - JWT token string
 * @returns Decoded payload
 * @throws {JsonWebTokenError} If token is invalid
 * @throws {TokenExpiredError} If token is expired
 */
export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
  return decoded;
}
