const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:Ks26feb%402006@db.qbrdfnhksqoaagstvdzk.supabase.co:5432/postgres' });
const days = 30;

async function run() {
  try {
    // 2. /api/admin/users/active
    await pool.query(`
      SELECT
        DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS day,
        COUNT(DISTINCT COALESCE(user_id::text, fingerprint_id)) AS active_users
      FROM tracking_events
      WHERE created_at >= CURRENT_DATE - ($1 || ' days')::INTERVAL
      GROUP BY day
      ORDER BY day ASC
    `, [days]);
    await pool.query(`
      SELECT COUNT(DISTINCT COALESCE(user_id::text, fingerprint_id)) AS wau
      FROM tracking_events WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    await pool.query(`
      SELECT COUNT(DISTINCT COALESCE(user_id::text, fingerprint_id)) AS mau
      FROM tracking_events WHERE created_at >= NOW() - INTERVAL '30 days'
    `);
    await pool.query(`
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
    console.log('USERS/ACTIVE OK');

    // 3. /api/admin/health
    await pool.query(`
      SELECT
        DATE(logged_at AT TIME ZONE 'Asia/Kolkata') AS day,
        ROUND(AVG(mood)) AS avg_mood,
        COUNT(*) AS total_logs
      FROM mood_logs
      WHERE logged_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY day
      ORDER BY day ASC
    `, [days]);
    await pool.query(`
      SELECT
        CASE
          WHEN mood <= 2 THEN 'Low (1-2)'
          WHEN mood = 3 THEN 'Neutral (3)'
          ELSE 'Good (4-5)'
        END AS bucket,
        COUNT(*) AS count
      FROM mood_logs
      WHERE logged_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY bucket
    `, [days]);
    await pool.query(`
      SELECT
        type,
        COUNT(*) FILTER (WHERE risk <= 33) AS low_risk,
        COUNT(*) FILTER (WHERE risk > 33 AND risk <= 66) AS moderate_risk,
        COUNT(*) FILTER (WHERE risk > 66) AS high_risk,
        COUNT(*) AS total
      FROM assessments
      WHERE taken_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY type
    `, [days]);
    console.log('HEALTH OK');

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

run();
