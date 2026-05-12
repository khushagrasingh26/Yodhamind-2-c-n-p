require('dotenv').config();
const db = require('../api/db');

async function checkSchema() {
  try {
    const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', tables.rows.map(r => r.table_name));

    const views = await db.query("SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'");
    console.log('Materialized Views:', views.rows.map(r => r.matviewname));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

checkSchema();
