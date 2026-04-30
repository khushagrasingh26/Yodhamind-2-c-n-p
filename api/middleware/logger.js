/**
 * api/middleware/logger.js — Structured Logger
 * ═════════════════════════════════════════════
 *
 * Replaces raw console.error/console.log with structured,
 * levelled logging. Uses pino for performance and JSON output
 * in production, pretty-printed in development.
 *
 * Usage:
 *   const logger = require('../middleware/logger');
 *
 *   logger.info({ userId: '...' }, 'User logged in');
 *   logger.warn({ email }, 'Failed login attempt');
 *   logger.error({ err, route: 'auth/login' }, 'Login failed');
 *
 * If pino is not installed, gracefully falls back to console.*
 * so the app never crashes due to missing logger dependency.
 */

'use strict';

let logger;

try {
  const pino = require('pino');

  const isProduction = process.env.NODE_ENV === 'production';
  const isTest       = process.env.NODE_ENV === 'test';

  logger = pino({
    level: isTest ? 'silent' : (process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug')),

    // In production: JSON for log aggregation
    // In dev: pretty-print with timestamps
    transport: isProduction ? undefined : {
      target: 'pino-pretty',
      options: {
        colorize:      true,
        translateTime: 'SYS:standard',
        ignore:        'pid,hostname'
      }
    },

    // Base fields attached to every log line
    base: {
      service: 'yodhamind-api',
      env:     process.env.NODE_ENV || 'development'
    },

    // Redact sensitive fields from logs
    redact: {
      paths: [
        'password',
        'password_hash',
        'token',
        'refreshToken',
        'accessToken',
        'authorization',
        'req.headers.authorization',
        'req.headers.cookie'
      ],
      censor: '[REDACTED]'
    },

    // Serializers for common objects
    serializers: {
      err: pino.stdSerializers.err,
      req: (req) => ({
        method: req.method,
        url:    req.url,
        ip:     req.ip
      }),
      res: (res) => ({
        statusCode: res.statusCode
      })
    }
  });

} catch {
  // Pino not installed — fall back to console with structured-ish output
  const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

  logger = {};

  levels.forEach(level => {
    logger[level] = (objOrMsg, msg) => {
      const timestamp = new Date().toISOString();
      if (typeof objOrMsg === 'string') {
        console[level === 'fatal' ? 'error' : (level === 'trace' || level === 'debug') ? 'log' : level](
          `[${timestamp}] ${level.toUpperCase()}: ${objOrMsg}`
        );
      } else {
        const message = msg || '';
        console[level === 'fatal' ? 'error' : (level === 'trace' || level === 'debug') ? 'log' : level](
          `[${timestamp}] ${level.toUpperCase()}: ${message}`,
          objOrMsg
        );
      }
    };
  });

  logger.child = () => logger;
}

module.exports = logger;
