/**
 * Centralized logging using Pino.
 * Provides structured JSON logging in production and pretty-printed logs in development.
 */

import pino from 'pino';
import { config } from '../config/index.js';

/**
 * Global logger instance.
 * Use child loggers with correlation IDs for request-scoped logging.
 */
export const logger = pino({
  level: config.logLevel,
  transport:
    config.nodeEnv !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
