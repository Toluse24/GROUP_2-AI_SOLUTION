// CV upload, extracted skills, and profile editing.
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const pool = require('../db');
const { analyseCV } = require('../cv');
const { canonical, categoryOf } = require('../skills');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /\.(pdf|docx?|txt)$/i.test(file.originalname) ? cb(null, true) : cb(Object.assign(new Error('Please upload a PDF or DOCX file.'), { status: 400 })),
});

async function skillIdFor(conn, name) {
  await conn.execute('INSERT INTO skills(skill_name, category) VALUES(?, ?) ON DUPLICATE KEY UPDATE category=COALESCE(category, VALUES(category))', [name, categoryOf(name)]);
  const [[row]] = await conn.execute('SELECT id FROM skills WHERE skill_name=?', [name]);
  return row.id;
}

async function loadResumeState(userId) {
  const [[resume]] = await pool.execute(
    `SELECT id, original_name, size_bytes, summary, detected_role, experience_level, extraction_source, uploaded_at
       FROM resumes WHERE user_id=? AND is_active=1 ORDER BY id DESC LIMIT 1`, [userId]);
  const [skills] = await pool.execute(
    `SELECT s.skill_name AS name, COALESCE(s.category,'Other') AS category, us.proficiency
       FROM user_skills us JOIN skills s ON s.id=us.skill_id WHERE us.user_id=? ORDER BY us.proficiency DESC, s.skill_name`, [userId]);
  const [[profile]] = await pool.execute(
    'SELECT headline, target_role, location FROM user_profiles WHERE user_id=?', [userId]);
  return { resume: resume || null, skills, profile: profile || {} };
}

module.exports = function resumeRoutes(requireAuth) {
  const router = express.Router();

  router.get('/resume', requireAuth, async (req, res) => {
    res.json(await loadResumeState(req.user.id));
  });

  router.post('/resume', requireAuth, (req, res, next) => upload.single('resume')(req, res, err => {
    if (err) return res.status(err.status || 400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'The file is larger than the 5 MB limit.' : err.message });
    next();
  }), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Choose a CV file to upload.' });
    let conn;
    try {
      const cv = await analyseCV(req.file.path, req.file.originalname);
      conn = await pool.getConnection();
      await conn.beginTransaction();
      await conn.execute('UPDATE resumes SET is_active=0 WHERE user_id=?', [req.user.id]);
      await conn.execute(
        `INSERT INTO resumes(user_id, original_name, stored_name, mime_type, size_bytes, extracted_text, summary, detected_role, experience_level, extraction_source)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
        [req.user.id, req.file.originalname.slice(0, 255), req.file.filename, req.file.mimetype, req.file.size,
          cv.text, cv.summary, cv.detected_role, cv.experience_level, cv.source]);
      // The new CV replaces the previous skill set.
      await conn.execute('DELETE FROM user_skills WHERE user_id=?', [req.user.id]);
      for (const s of cv.skills) {
        const id = await skillIdFor(conn, s.name);
        await conn.execute('INSERT IGNORE INTO user_skills(user_id, skill_id, proficiency, is_verified) VALUES(?,?,?,1)', [req.user.id, id, s.proficiency * 20]);
      }
      const role = cv.detected_role;
      const levelWord = (cv.experience_level || '').split('-')[0].toLowerCase();
      const headline = role && levelWord && !role.toLowerCase().includes(levelWord) ? `${cv.experience_level} ${role}` : role;
      await conn.execute(
        'UPDATE user_profiles SET target_role=COALESCE(?, target_role), headline=? WHERE user_id=?',
        [role, headline ? headline.slice(0, 180) : null, req.user.id]);
      await conn.commit();
      res.status(201).json({ message: `CV analysed. ${cv.skills.length} skills found.`, ...(await loadResumeState(req.user.id)) });
    } catch (e) {
      if (conn) await conn.rollback().catch(() => {});
      if (!e.status) console.error(e);
      res.status(e.status || 500).json({ message: e.status ? e.message : 'Could not process this CV. Please try another file.' });
    } finally {
      if (conn) conn.release();
    }
  });

  router.post('/skills', requireAuth, async (req, res) => {
    const name = canonical(req.body.name);
    if (!name || name.length < 1) return res.status(400).json({ message: 'Enter a skill name.' });
    const conn = await pool.getConnection();
    try {
      const id = await skillIdFor(conn, name);
      await conn.execute('INSERT IGNORE INTO user_skills(user_id, skill_id, proficiency) VALUES(?,?,60)', [req.user.id, id]);
    } finally { conn.release(); }
    res.status(201).json(await loadResumeState(req.user.id));
  });

  router.delete('/skills/:name', requireAuth, async (req, res) => {
    await pool.execute(
      'DELETE us FROM user_skills us JOIN skills s ON s.id=us.skill_id WHERE us.user_id=? AND s.skill_name=?',
      [req.user.id, req.params.name]);
    res.json(await loadResumeState(req.user.id));
  });

  router.put('/profile', requireAuth, async (req, res) => {
    const clean = v => (v == null ? null : String(v).trim().slice(0, 120) || null);
    await pool.execute('UPDATE user_profiles SET target_role=?, location=? WHERE user_id=?',
      [clean(req.body.target_role), clean(req.body.location), req.user.id]);
    res.json(await loadResumeState(req.user.id));
  });

  return router;
};
