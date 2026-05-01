/**
 * api/routes/track.js — Analytics Event Ingestion
 * ═════════════════════════════════════════════════
 *
 * POST /api/track    Batch event ingestion (public, rate-limited)
 *
 * Accepts up to 50 events per request from the ym-track.js client.
 * Events are validated and inserted into the tracking_events table.
 * No authentication required (supports anonymous tracking).
 */

'use strict';

const express = require('express');
const db      = require('../db');

const router = express.Router();

/* ── Allowed event names ───────────────────── */
const ALLOWED_EVENTS = new Set([
  'SESSION_STARTED', 'SESSION_ENDED', 'PAGE_VIEWED',
  'AUTH_MODAL_OPENED', 'AUTH_GOOGLE_CLICKED', 'AUTH_COMPLETED', 'AUTH_FAILED', 'SIGN_OUT',
  'GAME_PAGE_VIEWED', 'MOOD_FILTER_SELECTED',
  'GAME_CLICKED', 'GAME_STARTED', 'GAME_COMPLETED', 'GAME_ABANDONED',
  'ASSESSMENT_STARTED', 'ASSESSMENT_COMPLETED', 'ASSESSMENT_ABANDONED',
  'MOOD_LOGGED', 'JOURNAL_CREATED',
  'BREATHING_MODAL_OPENED', 'BREATHING_STARTED', 'BREATHING_COMPLETED',
  'COMMUNITY_VIEWED', 'POST_CREATED', 'POST_RELATED',
  'CTA_CLICKED', 'NAV_LINK_CLICKED', 'CRISIS_LINK_CLICKED',
  'COUNSELOR_PROFILE_VIEWED', 'BOOKING_COMPLETED'
]);

/* ── Rate limiter specifically for tracking ── */
const rateLimit = require('express-rate-limit');
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max:      100,          // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many tracking requests.' } }
});

router.use(trackLimiter);

/* ════════════════════════════════════════════════
   POST /api/track
   Body: { events: [{ event_name, session_id, fingerprint_id, user_id?, payload?, context? }] }
════════════════════════════════════════════════ */
router.post('/', async (req, res) => {
  const { events } = req.body;

  if (!events || !Array.isArray(events) || events.length === 0) {
    return res.status(422).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'events array is required and must not be empty.' }
    });
  }

  if (events.length > 50) {
    return res.status(422).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Maximum 50 events per request.' }
    });
  }

  // Validate and filter events
  const validEvents = [];
  for (const evt of events) {
    if (!evt.event_name || !ALLOWED_EVENTS.has(evt.event_name)) continue;
    if (!evt.session_id || typeof evt.session_id !== 'string') continue;

    validEvents.push({
      event_name:   evt.event_name,
      session_id:   evt.session_id.slice(0, 40),
      user_id:      null,  // We don't resolve user_id from email client-side for privacy
      fingerprint_id: (evt.fingerprint_id || '').slice(0, 64) || null,
      payload:   evt.payload && typeof evt.payload === 'object' ? evt.payload : {},
      context:      evt.context && typeof evt.context === 'object' ? evt.context : {}
    });
  }

  if (validEvents.length === 0) {
    return res.json({ ok: true, data: { inserted: 0 } });
  }

  try {
    // Batch insert using unnest for performance
    const eventNames   = validEvents.map(e => e.event_name);
    const sessionIds   = validEvents.map(e => e.session_id);
    const anonymousIds = validEvents.map(e => e.fingerprint_id);
    const payload      = validEvents.map(e => JSON.stringify(e.payload));
    const pages        = validEvents.map(e => e.context.page_url || null);
    const referrers    = validEvents.map(e => e.context.referrer || null);
    const deviceTypes  = validEvents.map(e => e.context.device_type || null);

    await db.query(
      `INSERT INTO tracking_events (event_name, session_id, fingerprint_id, payload, page, referrer, device_type)
       SELECT * FROM UNNEST(
         $1::text[],
         $2::text[],
         $3::text[],
         $4::jsonb[],
         $5::text[],
         $6::text[],
         $7::text[]
       )`,
      [eventNames, sessionIds, anonymousIds, payload, pages, referrers, deviceTypes]
    );

    return res.json({ ok: true, data: { inserted: validEvents.length } });

  } catch (err) {
    console.error('[track POST]', err.message);
    // Silent success — analytics should never return errors to the client
    return res.json({ ok: true, data: { inserted: 0 } });
  }
});

module.exports = router;
