const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:Ks26feb%402006@db.qbrdfnhksqoaagstvdzk.supabase.co:5432/postgres' });

async function check() {
  try {
    const games = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'game_scores';");
    console.log('game_scores:', games.rows.map(r=>r.column_name));
    
    const mood = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'mood_logs';");
    console.log('mood_logs:', mood.rows.map(r=>r.column_name));
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
