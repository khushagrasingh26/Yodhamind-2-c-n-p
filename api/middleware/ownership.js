/**
 * api/middleware/ownership.js — Resource Ownership Enforcement
 * ═════════════════════════════════════════════════════════════
 *
 * Reusable middleware factory for verifying that the authenticated
 * user owns the requested resource. Admins bypass ownership checks.
 *
 * Usage:
 *   const { requireOwnership } = require('../middleware/ownership');
 *
 *   // Simple: check user_id column
 *   router.delete('/journal/:id',
 *     authenticate,
 *     requireOwnership('journal_entries', 'id'),
 *     deleteHandler
 *   );
 *
 *   // Custom query function
 *   router.patch('/custom/:id',
 *     authenticate,
 *     requireOwnership(async (req) => {
 *       const r = await db.query('SELECT user_id FROM custom WHERE id = $1', [req.params.id]);
 *       return r.rows[0];
 *     }),
 *     handler
 *   );
 */

'use strict';

const db = require('../db');

/**
 * Create ownership-checking middleware.
 *
 * @param {string|Function} tableOrQuery
 *   - If string: table name to query (expects `user_id` and `id` columns)
 *   - If function: async (req) => resource row or null
 * @param {string} [paramName='id'] - req.params key for the resource ID
 * @returns {Function} Express middleware
 */
function requireOwnership(tableOrQuery, paramName = 'id') {
  return async function ownershipGuard(req, res, next) {
    // Must be used after authenticate()
    if (!req.user) {
      return res.status(401).json({
        ok:    false,
        error: { code: 'NO_TOKEN', message: 'Authentication required.' }
      });
    }

    try {
      let resource;

      if (typeof tableOrQuery === 'function') {
        // Custom query function
        resource = await tableOrQuery(req);
      } else {
        // Table name — standard lookup
        const result = await db.query(
          `SELECT user_id FROM ${tableOrQuery} WHERE id = $1`,
          [req.params[paramName]]
        );
        resource = result.rows[0];
      }

      if (!resource) {
        return res.status(404).json({
          ok:    false,
          error: { code: 'NOT_FOUND', message: 'Resource not found.' }
        });
      }

      // Admins bypass ownership
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }

      // Check ownership
      if (resource.user_id !== req.user.id) {
        return res.status(403).json({
          ok:    false,
          error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource.' }
        });
      }

      req.resource = resource;
      return next();

    } catch (err) {
      console.error('[ownership] Check failed:', err.message);
      return res.status(500).json({
        ok:    false,
        error: { code: 'SERVER_ERROR', message: 'Authorization check failed.' }
      });
    }
  };
}

module.exports = { requireOwnership };
