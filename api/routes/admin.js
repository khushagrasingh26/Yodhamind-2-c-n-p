/**
 * api/routes/admin.js — Developer Analytics Dashboard API
 * ═══════════════════════════════════════════════════════════
 *
 * All routes require: authenticate + requireRole(['admin'])
 *
 * GET   /api/admin/overview        KPI summary
 * GET   /api/admin/metrics/daily   Daily time series
 * GET   /api/admin/games           Game-level analytics
 * GET   /api/admin/users/active    DAU/WAU/MAU breakdown
 * GET   /api/admin/health-signals  Mental health impact metrics
 * GET   /api/admin/realtime        Last 50 events (live feed)
 * GET   /api/admin/funnel          Conversion funnel data
 * POST  /api/admin/refresh-views   Refresh materialized views
 */

'use strict';

const express = require('express');
const db      = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

/* ── All admin routes require admin role ───── */
router.use(authenticate);
router.use(requireRole(['admin']));

/* ════════════════════════════════════════════════
   GET /api/admin/overview
   KPI cards for the dashboard header.
   Query: ?days=30
════════════════════════════════════════════════ */
router.get('/overview', async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);

  try {
    // Current period
    const current = await db.query(`
      SELECT
        COUNT(DISTINCT session_id)                                          AS sessions,
        COUNT(DISTINCT anonymous_id)                                        AS unique_visitors,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)          AS auth_users,
        COUNT(*) FILTER (WHERE event_name = 'GAME_COMPLETED')               AS games_completed,
        COUNT(*) FILTER (WHERE event_name = 'ASSESSMENT_COMPLETED')         AS assessments_completed,
        COUNT(*) FILTER (WHERE event_name = 'MOOD_LOGGED')                  AS moods_logged,
        COUNT(*) FILTER (WHERE event_name = 'JOURNAL_CREATED')              AS journals_created,
        COUNT(*) FILTER (WHERE event_name = 'BREATHING_COMPLETED')          AS breathing_sessions,
        COUNT(*) FILTER (WHERE event_name = 'AUTH_COMPLETED')               AS signups,
        COUNT(*) FILTER (WHERE event_name = 'CTA_CLICKED')                  AS cta_clicks,
        COUNT(*) FILTER (WHERE event_name = 'CRISIS_LINK_CLICKED')          AS crisis_clicks
      FROM analytics_events
      WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
    `, [days]);

    // Previous period (for comparison)
    const previous = await db.query(`
      SELECT
        COUNT(DISTINCT session_id)                                          AS sessions,
        COUNT(*) FILTER (WHERE event_name = 'GAME_COMPLETED')               AS games_completed,
        COUNT(*) FILTER (WHERE event_name = 'AUTH_COMPLETED')               AS signups
      FROM analytics_events
      WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
        AND created_at <  NOW() - ($2 || ' days')::INTERVAL
    `, [days * 2, days]);

    // Existing DB metrics
    const users = await db.query(`SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL`);
    const wellnessAvg = await db.query(`
      SELECT ROUND(AVG(score)) AS avg_score FROM wellness_scores
      WHERE computed_at >= NOW() - ($1 || ' days')::INTERVAL
    `, [days]);

    // DAU (today)
    const dau = await db.query(`
      SELECT COUNT(DISTINCT COALESCE(user_id::text, anonymous_id)) AS dau
      FROM analytics_events
      WHERE created_at >= CURRENT_DATE
    `);

    return res.json({
      ok: true,
      data: {
        period_days: days,
        current:     current.rows[0],
        previous:    previous.rows[0],
        total_users: parseInt(users.rows[0].total, 10),
        avg_wellness: parseInt(wellnessAvg.rows[0].avg_score, 10) || 0,
        dau:          parseInt(dau.rows[0].dau, 10)
      }
    });
  } catch (err) {
    console.error('[admin/overview]', err.message);
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/* ════════════════════════════════════════════════
   GET /api/admin/metrics/daily
   Daily time series for charts.
   Query: ?days=30
════════════════════════════════════════════════ */
router.get('/metrics/daily', async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);

  try {
    // Try materialized view first, fall back to raw query
    let result;
    try {
      result = await db.query(`
        SELECT * FROM mv_daily_metrics
        WHERE day >= CURRENT_DATE - $1
        ORDER BY day ASC
      `, [days]);
    } catch {
      // Materialized view doesn't exist yet — query raw
      result = await db.query(`
        SELECT
          DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS day,
          COUNT(DISTINCT session_id)                    AS total_sessions,
          COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS auth_users,
          COUNT(DISTINCT COALESCE(anonymous_id, session_id)) AS unique_visitors,
          COUNT(*) FILTER (WHERE event_name = 'PAGE_VIEWED')     AS page_views,
          COUNT(*) FILTER (WHERE event_name = 'GAME_STARTED')    AS games_started,
          COUNT(*) FILTER (WHERE event_name = 'GAME_COMPLETED')  AS games_completed,
          COUNT(*) FILTER (WHERE event_name = 'ASSESSMENT_COMPLETED') AS assessments_completed,
          COUNT(*) FILTER (WHERE event_name = 'MOOD_LOGGED')     AS moods_logged,
          COUNT(*) FILTER (WHERE event_name = 'JOURNAL_CREATED') AS journals_created,
          COUNT(*) FILTER (WHERE event_name = 'BREATHING_COMPLETED') AS breathing_sessions,
          COUNT(*) FILTER (WHERE event_name = 'AUTH_COMPLETED')  AS signups,
          COUNT(*) FILTER (WHERE event_name = 'CTA_CLICKED')    AS cta_clicks,
          COUNT(*) FILTER (WHERE event_name = 'CRISIS_LINK_CLICKED') AS crisis_clicks
        FROM analytics_events
        WHERE created_at >= CURRENT_DATE - $1
        GROUP BY day
        ORDER BY day ASC
      `, [days]);
    }

    return res.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error('[admin/metrics/daily]', err.message);
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/* ════════════════════════════════════════════════
   GET /api/admin/games
   Game-level analytics.
   Query: ?days=30
════════════════════════════════════════════════ */
router.get('/games', async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);

  try {
    // Game comparison data from analytics_events
    const eventData = await db.query(`
      SELECT
        properties->>'game_id' AS game_id,
        COUNT(*) FILTER (WHERE event_name = 'GAME_STARTED')   AS starts,
        COUNT(*) FILTER (WHERE event_name = 'GAME_COMPLETED') AS completions,
        COUNT(*) FILTER (WHERE event_name = 'GAME_ABANDONED') AS abandonments,
        COUNT(*) FILTER (WHERE event_name = 'GAME_CLICKED')   AS clicks
      FROM analytics_events
      WHERE event_name IN ('GAME_STARTED', 'GAME_COMPLETED', 'GAME_ABANDONED', 'GAME_CLICKED')
        AND created_at >= NOW() - ($1 || ' days')::INTERVAL
        AND properties->>'game_id' IS NOT NULL
      GROUP BY game_id
      ORDER BY starts DESC
    `, [days]);

    // Also pull data from the existing game_scores table
    const dbData = await db.query(`
      SELECT
        game_id,
        COUNT(*)            AS total_sessions,
        AVG(score)::int     AS avg_score,
        MAX(score)          AS max_score,
        AVG(duration_ms)::int AS avg_duration_ms,
        COUNT(DISTINCT user_id) AS unique_players
      FROM game_scores
      WHERE played_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY game_id
      ORDER BY total_sessions DESC
    `, [days]);

    return res.json({
      ok: true,
      data: {
        event_metrics: eventData.rows,
        db_metrics:    dbData.rows
      }
    });
  } catch (err) {
    console.error('[admin/games]', err.message);
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/* ════════════════════════════════════════════════
   GET /api/admin/users/active
   DAU / WAU / MAU time series.
   Query: ?days=90
════════════════════════════════════════════════ */
router.get('/users/active', async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 90, 365);

  try {
    // DAU over time
    const dau = await db.query(`
      SELECT
        DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS day,
        COUNT(DISTINCT COALESCE(user_id::text, anonymous_id)) AS active_users
      FROM analytics_events
      WHERE created_at >= CURRENT_DATE - $1
      GROUP BY day
      ORDER BY day ASC
    `, [days]);

    // Current WAU and MAU
    const wau = await db.query(`
      SELECT COUNT(DISTINCT COALESCE(user_id::text, anonymous_id)) AS wau
      FROM analytics_events WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    const mau = await db.query(`
      SELECT COUNT(DISTINCT COALESCE(user_id::text, anonymous_id)) AS mau
      FROM analytics_events WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    // Streak distribution from existing streaks table
    const streaks = await db.query(`
      SELECT
        CASE
          WHEN current_streak = 0 THEN '0'
          WHEN current_streak BETWEEN 1 AND 2 THEN '1-2'
          WHEN current_streak BETWEEN 3 AND 6 THEN '3-6'
          WHEN current_streak BETWEEN 7 AND 13 THEN '7-13'
          ELSE '14+'
        END AS bucket,
        COUNT(*) AS user_count
      FROM streaks
      GROUP BY bucket
      ORDER BY MIN(current_streak) ASC
    `);

    return res.json({
      ok: true,
      data: {
        dau_series: dau.rows,
        wau:        parseInt(wau.rows[0].wau, 10),
        mau:        parseInt(mau.rows[0].mau, 10),
        stickiness: parseInt(wau.rows[0].wau, 10) > 0
          ? Math.round((parseInt(dau.rows[dau.rows.length - 1]?.active_users || 0, 10) / parseInt(wau.rows[0].wau, 10)) * 100)
          : 0,
        streak_distribution: streaks.rows
      }
    });
  } catch (err) {
    console.error('[admin/users/active]', err.message);
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/* ════════════════════════════════════════════════
   GET /api/admin/health-signals
   Mental health impact metrics.
   Query: ?days=30
════════════════════════════════════════════════ */
router.get('/health-signals', async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);

  try {
    // Mood distribution from mood_logs
    const moodDist = await db.query(`
      SELECT mood, label, COUNT(*) AS count
      FROM mood_logs
      WHERE logged_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY mood, label
      ORDER BY mood ASC
    `, [days]);

    // Average mood over time
    const moodTrend = await db.query(`
      SELECT
        DATE(logged_at AT TIME ZONE 'Asia/Kolkata') AS day,
        ROUND(AVG(mood), 2) AS avg_mood,
        COUNT(*) AS entries
      FROM mood_logs
      WHERE logged_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY day
      ORDER BY day ASC
    `, [days]);

    // Assessment risk distribution
    const riskDist = await db.query(`
      SELECT
        type,
        COUNT(*) FILTER (WHERE risk <= 33)  AS low_risk,
        COUNT(*) FILTER (WHERE risk > 33 AND risk <= 66) AS moderate_risk,
        COUNT(*) FILTER (WHERE risk > 66) AS high_risk,
        COUNT(*) AS total
      FROM assessments
      WHERE taken_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY type
    `, [days]);

    // Wellness score distribution
    const wellnessDist = await db.query(`
      SELECT
        CASE
          WHEN score < 20 THEN '0-19'
          WHEN score < 40 THEN '20-39'
          WHEN score < 60 THEN '40-59'
          WHEN score < 80 THEN '60-79'
          ELSE '80-100'
        END AS bucket,
        COUNT(*) AS count
      FROM wellness_scores
      WHERE computed_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY bucket
      ORDER BY MIN(score)
    `, [days]);

    // Crisis signals
    const crisisCount = await db.query(`
      SELECT COUNT(*) AS total
      FROM analytics_events
      WHERE event_name = 'CRISIS_LINK_CLICKED'
        AND created_at >= NOW() - ($1 || ' days')::INTERVAL
    `, [days]);

    // Calming tool sessions per day
    const calmingTrend = await db.query(`
      SELECT
        DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS day,
        COUNT(*) FILTER (WHERE event_name = 'BREATHING_COMPLETED') AS breathing,
        COUNT(*) FILTER (WHERE properties->>'game_id' IN ('mandala', 'aura'))  AS calming_games
      FROM analytics_events
      WHERE event_name IN ('BREATHING_COMPLETED', 'GAME_COMPLETED')
        AND created_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY day
      ORDER BY day ASC
    `, [days]);

    return res.json({
      ok: true,
      data: {
        mood_distribution: moodDist.rows,
        mood_trend:        moodTrend.rows,
        risk_distribution: riskDist.rows,
        wellness_distribution: wellnessDist.rows,
        crisis_clicks:     parseInt(crisisCount.rows[0].total, 10),
        calming_trend:     calmingTrend.rows
      }
    });
  } catch (err) {
    console.error('[admin/health-signals]', err.message);
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/* ════════════════════════════════════════════════
   GET /api/admin/realtime
   Last 50 events — live event feed.
════════════════════════════════════════════════ */
router.get('/realtime', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        event_name,
        session_id,
        anonymous_id,
        properties,
        context->>'page_url'     AS page,
        context->>'device_type'  AS device,
        created_at
      FROM analytics_events
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return res.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error('[admin/realtime]', err.message);
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/* ════════════════════════════════════════════════
   GET /api/admin/funnel
   Conversion funnel data.
   Query: ?type=auth|game|assessment&days=30
════════════════════════════════════════════════ */
router.get('/funnel', async (req, res) => {
  const type = req.query.type || 'auth';
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);

  try {
    let funnelSteps;

    if (type === 'auth') {
      funnelSteps = ['PAGE_VIEWED', 'AUTH_MODAL_OPENED', 'AUTH_GOOGLE_CLICKED', 'AUTH_COMPLETED'];
    } else if (type === 'game') {
      funnelSteps = ['GAME_PAGE_VIEWED', 'GAME_CLICKED', 'GAME_STARTED', 'GAME_COMPLETED'];
    } else if (type === 'assessment') {
      funnelSteps = ['PAGE_VIEWED', 'ASSESSMENT_STARTED', 'ASSESSMENT_COMPLETED'];
    } else {
      return res.status(422).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'type must be: auth, game, or assessment' }
      });
    }

    const result = await db.query(`
      SELECT
        event_name,
        COUNT(DISTINCT session_id) AS unique_sessions
      FROM analytics_events
      WHERE event_name = ANY($1)
        AND created_at >= NOW() - ($2 || ' days')::INTERVAL
      GROUP BY event_name
    `, [funnelSteps, days]);

    // Map results to funnel order
    const funnelData = funnelSteps.map(step => {
      const row = result.rows.find(r => r.event_name === step);
      return {
        step:     step,
        sessions: row ? parseInt(row.unique_sessions, 10) : 0
      };
    });

    return res.json({ ok: true, data: funnelData });
  } catch (err) {
    console.error('[admin/funnel]', err.message);
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/* ════════════════════════════════════════════════
   POST /api/admin/refresh-views
   Refresh materialized views.
════════════════════════════════════════════════ */
router.post('/refresh-views', async (req, res) => {
  try {
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_metrics');
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_game_metrics');
    return res.json({ ok: true, message: 'Views refreshed.' });
  } catch (err) {
    console.error('[admin/refresh-views]', err.message);
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

module.exports = router;
