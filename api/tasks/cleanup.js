/**
 * api/tasks/cleanup.js — Token & Data Cleanup Task
 * ═════════════════════════════════════════════════
 *
 * Removes expired/revoked refresh tokens and old login attempts.
 * Run periodically via cron, npm script, or Vercel cron.
 *
 * Usage:
 *   node api/tasks/cleanup.js
 *   npm run cleanup
 *
 * Can also be imported and called from application code:
 *   const { runCleanup } = require('./tasks/cleanup');
 *   await runCleanup();
 */

'use strict';

require('dotenv').config();

const db = require('../db');

async function runCleanup() {
  const results = {};

  console.log('[cleanup] Starting token & data cleanup...');

  try {
    // 1. Delete revoked refresh tokens older than 7 days
    const revokedResult = await db.query(
      `DELETE FROM refresh_tokens
       WHERE revoked = TRUE AND created_at < NOW() - INTERVAL '7 days'`
    );
    results.revokedTokens = revokedResult.rowCount || 0;

    // 2. Delete expired refresh tokens older than 30 days
    const expiredResult = await db.query(
      `DELETE FROM refresh_tokens
       WHERE expires_at < NOW() - INTERVAL '30 days'`
    );
    results.expiredTokens = expiredResult.rowCount || 0;

    // 3. Delete old login attempts (keep 90 days for audit)
    const attemptsResult = await db.query(
      `DELETE FROM login_attempts
       WHERE attempted_at < NOW() - INTERVAL '90 days'`
    );
    results.oldAttempts = attemptsResult.rowCount || 0;

    console.log('[cleanup] ✅ Cleanup complete:', results);
    return results;

  } catch (err) {
    console.error('[cleanup] ❌ Cleanup failed:', err.message);
    throw err;
  }
}

// Run directly if called as script
if (require.main === module) {
  runCleanup()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runCleanup };
