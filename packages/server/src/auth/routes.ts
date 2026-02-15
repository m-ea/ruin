/**
 * Authentication routes: registration and login.
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { signToken } from './jwt.js';

const router: Router = Router();

/**
 * Email validation regex: simple pattern requiring @ and a dot after @
 */
const EMAIL_REGEX = /\S+@\S+\.\S+/;

/**
 * Minimum password length requirement
 */
const MIN_PASSWORD_LENGTH = 8;

/**
 * bcrypt salt rounds for password hashing
 */
const BCRYPT_ROUNDS = 12;

/**
 * POST /auth/register
 * Creates a new account with email and password.
 *
 * Request body:
 * - email: string
 * - password: string
 *
 * Success response (201):
 * - token: JWT token
 * - accountId: UUID
 *
 * Error responses:
 * - 400 VALIDATION_ERROR: Invalid email or password
 * - 409 CONFLICT: Email already registered
 * - 500 INTERNAL_ERROR: Database or unexpected error
 */
router.post('/register', async (req: Request, res: Response) => {
  const { email: rawEmail, password } = req.body;

  // Normalize email to lowercase
  const email = rawEmail?.toLowerCase();

  // Validate email format
  if (!email || !EMAIL_REGEX.test(email)) {
    res.status(400).json({
      error: 'Invalid email format',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  // Validate password length
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Insert into database
    const result = await pool.query<{ id: string }>(
      'INSERT INTO accounts (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, passwordHash],
    );

    const accountId = result.rows[0]!.id;

    // Generate JWT
    const token = signToken({ sub: accountId, email });

    req.log.info({ email, accountId }, 'User registered successfully');

    res.status(201).json({
      token,
      accountId,
    });
  } catch (err: unknown) {
    // Check for duplicate email constraint violation
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === '23505'
    ) {
      req.log.warn({ email }, 'Registration failed: email already exists');
      res.status(409).json({
        error: 'Email already registered',
        code: 'CONFLICT',
      });
      return;
    }

    // Unexpected error
    req.log.error({ err, email }, 'Registration failed with unexpected error');
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /auth/login
 * Authenticates a user with email and password.
 *
 * Request body:
 * - email: string
 * - password: string
 *
 * Success response (200):
 * - token: JWT token
 * - accountId: UUID
 *
 * Error responses:
 * - 401 AUTH_FAILED: Invalid email or password
 * - 500 INTERNAL_ERROR: Database or unexpected error
 */
router.post('/login', async (req: Request, res: Response) => {
  const { email: rawEmail, password } = req.body;

  // Normalize email to lowercase
  const email = rawEmail?.toLowerCase();

  if (!email || !password) {
    res.status(401).json({
      error: 'Invalid email or password',
      code: 'AUTH_FAILED',
    });
    return;
  }

  try {
    // Look up account by email
    const result = await pool.query<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM accounts WHERE email = $1',
      [email],
    );

    if (result.rows.length === 0) {
      req.log.warn({ email }, 'Login failed: account not found');
      res.status(401).json({
        error: 'Invalid email or password',
        code: 'AUTH_FAILED',
      });
      return;
    }

    const account = result.rows[0]!;

    // Compare password with hash
    const passwordValid = await bcrypt.compare(password, account.password_hash);

    if (!passwordValid) {
      req.log.warn({ email }, 'Login failed: incorrect password');
      res.status(401).json({
        error: 'Invalid email or password',
        code: 'AUTH_FAILED',
      });
      return;
    }

    // Generate JWT
    const token = signToken({ sub: account.id, email });

    req.log.info({ email, accountId: account.id }, 'User logged in successfully');

    res.status(200).json({
      token,
      accountId: account.id,
    });
  } catch (err: unknown) {
    req.log.error({ err, email }, 'Login failed with unexpected error');
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
