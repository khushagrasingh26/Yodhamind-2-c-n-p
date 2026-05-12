const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:Ks26feb%402006@db.qbrdfnhksqoaagstvdzk.supabase.co:5432/postgres' });

async function run() {
  try {
    const validEvents = [{
      event_name: 'PAGE_VIEWED',
      session_id: 'test_session',
      fingerprint_id: 'test_fingerprint',
      payload: { test: true },
      context: { page_url: '/home', referrer: null, device_type: 'desktop' }
    }, {
      event_name: 'GAME_COMPLETED',
      session_id: 'test_session',
      fingerprint_id: 'test_fingerprint',
      payload: { game_id: 'breathing', score: 95 },
      context: { page_url: '/play', referrer: null, device_type: 'desktop' }
    }];

    const eventNames   = validEvents.map(e => e.event_name);
    const sessionIds   = validEvents.map(e => e.session_id);
    const anonymousIds = validEvents.map(e => e.fingerprint_id);
    const payload      = validEvents.map(e => JSON.stringify(e.payload));
    const pages        = validEvents.map(e => e.context.page_url || '');
    const referrers    = validEvents.map(e => e.context.referrer || '');
    const deviceTypes  = validEvents.map(e => e.context.device_type || 'unknown');

    const res = await pool.query(
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

    console.log('Inserted:', res.rowCount);
    
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

run();
