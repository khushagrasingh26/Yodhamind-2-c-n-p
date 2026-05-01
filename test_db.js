const db = require('./api/db');
db.query("SELECT COUNT(DISTINCT session_id) AS sessions, COUNT(DISTINCT fingerprint_id) AS unique_visitors FROM tracking_events WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL", [1])
  .then(r => console.log('Current Period:', r.rows))
  .catch(err => console.error('Error 1:', err))
  .finally(() => process.exit(0));
