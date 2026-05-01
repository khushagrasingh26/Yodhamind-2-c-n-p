const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:Ks26feb%402006@db.qbrdfnhksqoaagstvdzk.supabase.co:5432/postgres' });
const days = 1;

async function check() {
  try {
    const current = await pool.query(`
      SELECT
        COUNT(DISTINCT session_id)                                          AS sessions,
        COUNT(DISTINCT fingerprint_id)                                        AS unique_visitors,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)          AS auth_users,
        COUNT(*) FILTER (WHERE event_name = 'GAME_COMPLETED')               AS games_completed,
        COUNT(*) FILTER (WHERE event_name = 'ASSESSMENT_COMPLETED')         AS assessments_completed,
        COUNT(*) FILTER (WHERE event_name = 'MOOD_LOGGED')                  AS moods_logged,
        COUNT(*) FILTER (WHERE event_name = 'JOURNAL_CREATED')              AS journals_created,
        COUNT(*) FILTER (WHERE event_name = 'BREATHING_COMPLETED')          AS breathing_sessions,
        COUNT(*) FILTER (WHERE event_name = 'AUTH_COMPLETED')               AS signups,
        COUNT(*) FILTER (WHERE event_name = 'CTA_CLICKED')                  AS cta_clicks,
        COUNT(*) FILTER (WHERE event_name = 'CRISIS_LINK_CLICKED')          AS crisis_clicks
      FROM tracking_events
      WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
    `, [days]);
    console.log('Current OK');

    const previous = await pool.query(`
      SELECT
        COUNT(DISTINCT session_id)                                          AS sessions,
        COUNT(*) FILTER (WHERE event_name = 'GAME_COMPLETED')               AS games_completed,
        COUNT(*) FILTER (WHERE event_name = 'AUTH_COMPLETED')               AS signups
      FROM tracking_events
      WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
        AND created_at <  NOW() - ($2 || ' days')::INTERVAL
    `, [days * 2, days]);
    console.log('Previous OK');

    const users = await pool.query(`SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL`);
    console.log('Users OK');

    const wellnessAvg = await pool.query(`
      SELECT ROUND(AVG((raw_score::float / NULLIF(max_score, 0)) * 100)) AS avg_score FROM assessments
      WHERE taken_at >= NOW() - ($1 || ' days')::INTERVAL
    `, [days]);
    console.log('Wellness OK');

    const dau = await pool.query(`
      SELECT COUNT(DISTINCT COALESCE(user_id::text, fingerprint_id)) AS dau
      FROM tracking_events
      WHERE created_at >= CURRENT_DATE
    `);
    console.log('DAU OK');

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
