const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://postgres:Ks26feb%402006@db.qbrdfnhksqoaagstvdzk.supabase.co:5432/postgres' }); 
client.connect()
  .then(() => client.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'platform_feedback'"))
  .then(res => { console.log(res.rows); client.end(); })
  .catch(console.error);
