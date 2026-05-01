const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:Ks26feb%402006@db.qbrdfnhksqoaagstvdzk.supabase.co:5432/postgres' });
const days = 1;

async function check() {
  try {
    const result = await pool.query(`
        SELECT
          DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS day,
          COUNT(DISTINCT session_id)                    AS total_sessions,
          COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS auth_users,
          COUNT(DISTINCT COALESCE(fingerprint_id, session_id)) AS unique_visitors,
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
        FROM tracking_events
        WHERE created_at >= CURRENT_DATE - ($1 || ' days')::INTERVAL
        GROUP BY day
        ORDER BY day ASC
      `, [days]);
    console.log('Daily OK');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
