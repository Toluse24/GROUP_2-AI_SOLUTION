// Deletes one account and everything linked to it, so a demo sign-up can be repeated with the same email.
// Usage: npm run demo:reset -- someone@example.com
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

(async () => {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.log('Usage: npm run demo:reset -- someone@example.com');
    process.exit(1);
  }
  const [[user]] = await pool.execute('SELECT id FROM users WHERE email=?', [email]);
  if (!user) {
    console.log(`No account found for ${email}.`);
    process.exit(0);
  }
  const [files] = await pool.execute('SELECT stored_name FROM resumes WHERE user_id=?', [user.id]);
  await pool.execute('DELETE FROM users WHERE id=?', [user.id]); // cascades to profile, skills, CVs, matches, tutor chat, progress
  for (const f of files) fs.rmSync(path.join(__dirname, '..', 'uploads', path.basename(f.stored_name)), { force: true });
  console.log(`Deleted ${email} and ${files.length} uploaded CV file(s).`);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
