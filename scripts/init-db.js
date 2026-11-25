// Runs database/pivot_db.sql against the configured MySQL server. Safe to re-run.
require('dotenv').config();
const fs = require('fs'), path = require('path'), mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  await conn.query(fs.readFileSync(path.join(__dirname, '..', 'database', 'pivot_db.sql'), 'utf8'));
  const [t] = await conn.query('SHOW TABLES FROM pivot_db');
  console.log('pivot_db ready. Tables:', t.map(r => Object.values(r)[0]).join(', '));
  await conn.end();
})().catch(e => { console.error('DB init failed:', e.message); process.exit(1); });
