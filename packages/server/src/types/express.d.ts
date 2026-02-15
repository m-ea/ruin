/**
 * Express type extensions using declaration merging.
 * Adds custom properties to the Express Request interface.
 */

declare namespace Express {
  export interface Request {
    /** Unique correlation ID for request tracing */
    correlationId: string;

    /** Child logger with correlation ID attached */
    log: import('pino').Logger;

    /** Authenticated account ID (set by auth middleware) */
    accountId?: string;

    /** Authenticated account email (set by auth middleware) */
    email?: string;
  }
}
