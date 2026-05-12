const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:Ks26feb%402006@db.qbrdfnhksqoaagstvdzk.supabase.co:5432/postgres' });

async function seed() {
  try {
    console.log('Seeding dummy data for the dashboard...');
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    const user_id = userResult.rows[0]?.id || null;
    
    if (!user_id) {
      console.log('No users found in database to seed data for.');
      process.exit(0);
    }
    
    const fingerprint = 'dummy_fingerprint_xyz';
    const session = 'dummy_session_abc';

    // 1. tracking_events
    const eventTypes = [
      'PAGE_VIEWED', 'AUTH_MODAL_OPENED', 'AUTH_GOOGLE_CLICKED', 'AUTH_COMPLETED',
      'GAME_PAGE_VIEWED', 'GAME_CLICKED', 'GAME_STARTED', 'GAME_COMPLETED',
      'ASSESSMENT_STARTED', 'ASSESSMENT_COMPLETED',
      'MOOD_LOGGED', 'BREATHING_COMPLETED', 'CRISIS_LINK_CLICKED'
    ];

    for (let i = 0; i < 50; i++) {
      const e = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const d = Math.floor(Math.random() * 30);
      await pool.query(`
        INSERT INTO tracking_events (event_name, session_id, fingerprint_id, payload, page, referrer, device_type, created_at)
        VALUES ($1, $2, $3, '{}', '/home', 'google', 'desktop', NOW() - ($4 || ' days')::INTERVAL)
      `, [e, session + i, fingerprint, d]);
    }

    // 2. mood_logs
    for (let i = 0; i < 20; i++) {
      const d = Math.floor(Math.random() * 30);
      const mood = Math.floor(Math.random() * 5) + 1;
      await pool.query(`
        INSERT INTO mood_logs (user_id, mood, label, logged_at)
        VALUES ($1, $2, 'Test Mood', NOW() - ($3 || ' days')::INTERVAL)
      `, [user_id, mood, d]);
    }

    // 3. assessments (skipped due to unknown type constraint)

    // 4. game_scores
    for (let i = 0; i < 25; i++) {
      const d = Math.floor(Math.random() * 30);
      const score = Math.floor(Math.random() * 100);
      await pool.query(`
        INSERT INTO game_scores (user_id, game_id, score, duration_ms, played_at)
        VALUES ($1, 'breathing', $2, 60000, NOW() - ($3 || ' days')::INTERVAL)
      `, [user_id, score, d]);
    }

    // Refresh materialized views if they exist
    await pool.query('REFRESH MATERIALIZED VIEW mv_daily_metrics').catch(() => {});

    console.log('Seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}
seed();
