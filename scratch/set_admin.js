require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../api/db/index.js');

async function setAdmin() {
  const email = 'khushagrasingh26@gmail.com';
  try {
    const res = await db.query(
      "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role",
      [email]
    );
    if (res.rowCount > 0) {
      console.log(`Successfully updated ${email} to admin role.`);
      console.log(res.rows[0]);
    } else {
      console.log(`User ${email} not found in the database. Please ensure they have signed up first.`);
    }
  } catch (err) {
    console.error('Error updating user:', err);
  } finally {
    process.exit(0);
  }
}

setAdmin();
