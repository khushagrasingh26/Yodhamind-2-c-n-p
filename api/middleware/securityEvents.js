/**
 * api/middleware/securityEvents.js — Security Event Logger
 * ═══════════════════════════════════════════════════════════
 *
 * Centralized security event logging for audit trails.
 * All security-relevant actions flow through this module.
 *
 * Usage:
 *   const { logSecurityEvent, EVENTS } = require('../middleware/securityEvents');
 *
 *   logSecurityEvent(EVENTS.LOGIN_FAILED, {
 *     email: 'user@example.com',
 *     ip: req.ip,
 *     reason: 'invalid_password'
 *   });
 */

'use strict';

const logger = require('./logger');

/* ── Event type constants ──────────────────── */
const EVENTS = Object.freeze({
  // Authentication
  LOGIN_SUCCESS:      'LOGIN_SUCCESS',
  LOGIN_FAILED:       'LOGIN_FAILED',
  REGISTER_SUCCESS:   'REGISTER_SUCCESS',
  LOGOUT:             'LOGOUT',
  LOGOUT_ALL:         'LOGOUT_ALL',

  // Token security
  TOKEN_REFRESHED:    'TOKEN_REFRESHED',
  TOKEN_REUSED:       'TOKEN_REUSED',       // Possible token theft
  TOKEN_EXPIRED:      'TOKEN_EXPIRED',

  // Account security
  ACCOUNT_LOCKED:     'ACCOUNT_LOCKED',
  PASSWORD_CHANGED:   'PASSWORD_CHANGED',
  SUSPICIOUS_IP:      'SUSPICIOUS_IP',      // IP changed on refresh

  // Authorization
  FORBIDDEN_ACCESS:   'FORBIDDEN_ACCESS',
  ADMIN_ACTION:       'ADMIN_ACTION',

  // Content moderation
  CONTENT_BLOCKED:    'CONTENT_BLOCKED',
  CONTENT_FLAGGED:    'CONTENT_FLAGGED',

  // System
  RATE_LIMITED:       'RATE_LIMITED',
  INVALID_INPUT:      'INVALID_INPUT'
});

/**
 * Log a security event with structured data.
 *
 * @param {string} eventType  One of EVENTS constants
 * @param {Object} details    Event-specific data (email, ip, etc.)
 */
function logSecurityEvent(eventType, details = {}) {
  const event = {
    securityEvent: true,
    eventType,
    timestamp: new Date().toISOString(),
    ...details
  };

  // Use appropriate log level based on severity
  switch (eventType) {
    case EVENTS.TOKEN_REUSED:
    case EVENTS.ACCOUNT_LOCKED:
    case EVENTS.SUSPICIOUS_IP:
      logger.warn(event, `🔒 Security: ${eventType}`);
      break;

    case EVENTS.LOGIN_FAILED:
    case EVENTS.FORBIDDEN_ACCESS:
    case EVENTS.CONTENT_BLOCKED:
    case EVENTS.RATE_LIMITED:
      logger.warn(event, `⚠️ Security: ${eventType}`);
      break;

    case EVENTS.LOGIN_SUCCESS:
    case EVENTS.REGISTER_SUCCESS:
    case EVENTS.TOKEN_REFRESHED:
    case EVENTS.LOGOUT:
    case EVENTS.LOGOUT_ALL:
      logger.info(event, `✅ Security: ${eventType}`);
      break;

    default:
      logger.info(event, `Security: ${eventType}`);
  }
}

module.exports = { logSecurityEvent, EVENTS };
