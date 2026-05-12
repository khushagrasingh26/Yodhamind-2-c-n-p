require('dotenv').config();
const db = require('./api/db/index');
db.query('INSERT INTO platform_feedback (rating, message, page, user_agent) VALUES ($1, $2, $3, $4)', [5, 'test script', '/test', 'script']).then(() => {
  console.log('success');
  process.exit(0);
}).catch(e => {
  console.error('DB ERROR:', e.message);
  process.exit(1);
});
