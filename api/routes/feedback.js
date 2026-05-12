/**
 * api/routes/feedback.js — Platform Feedback API
 * ═══════════════════════════════════════════════
 *
 * POST  /api/feedback          Submit feedback (public, no auth)
 * GET   /api/feedback          List all feedback (admin only)
 */

'use strict';

const express = require('express');
const db      = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

/* ════════════════════════════════════════════════
   POST /api/feedback
   Public endpoint — anyone can submit feedback.
   No auth required so anonymous visitors can too.
════════════════════════════════════════════════ */
router.post('/', async (req, res) => {
  const { rating, message, page } = req.body;

  // Basic validation
  if (!rating && !message) {
    return res.status(422).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Rating or message is required.' }
    });
  }

  if (rating && (rating < 1 || rating > 5)) {
    return res.status(422).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Rating must be between 1 and 5.' }
    });
  }

  try {
    await db.query(
      `INSERT INTO platform_feedback (rating, message, page, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [
        rating || null,
        (message || '').substring(0, 1000) || null,
        (page || '').substring(0, 255),
        (req.headers['user-agent'] || '').substring(0, 500)
      ]
    );

    return res.status(201).json({ ok: true, message: 'Feedback received. Thank you!' });
  } catch (err) {
    console.error('[feedback] Insert error:', err.message);
    return res.status(500).json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: 'Could not save feedback.' }
    });
  }
});

/* ════════════════════════════════════════════════
   GET /api/feedback
   Admin-only: list all feedback, newest first.
   Query: ?limit=50&offset=0
════════════════════════════════════════════════ */
router.get('/', authenticate, requireRole(['admin']), async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const result = await db.query(
      `SELECT id, rating, message, page, user_agent, created_at
       FROM platform_feedback
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query('SELECT COUNT(*) AS total FROM platform_feedback');

    return res.json({
      ok: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
      limit,
      offset
    });
  } catch (err) {
    console.error('[feedback] List error:', err.message);
    return res.status(500).json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

module.exports = router;
