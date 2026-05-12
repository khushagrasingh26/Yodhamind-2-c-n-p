const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:Ks26feb%402006@db.qbrdfnhksqoaagstvdzk.supabase.co:5432/postgres' });
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'streaks';")
  .then(res => { console.log('streaks:', res.rows.map(r=>r.column_name)); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
