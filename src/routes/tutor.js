// AI tutor sessions per skill gap, learning progress, and "mark as learned" (re-scores matches).
const express = require('express');
const pool = require('../db');
const ai = require('../ai');
const { tutorTurn, resourcesFor } = require('../tutor');
const { canonical, categoryOf } = require('../skills');
const { runMatching } = require('../jobs');

const parse = v => (typeof v === 'string' ? JSON.parse(v) : v || []);
const TOTAL_STEPS = 4;

async function latestMatchFor(userId, jobId) {
  const [[m]] = await pool.execute(
    'SELECT match_percent AS fit, potential_percent AS potential, run_id FROM job_matches WHERE user_id=? AND job_id=? ORDER BY id DESC LIMIT 1', [userId, jobId]);
  return m || null; 
}

async function buildContext(user, skill, jobId) {
  const [skills] = await pool.execute(
    'SELECT s.skill_name AS name FROM user_skills us JOIN skills s ON s.id=us.skill_id WHERE us.user_id=? ORDER BY us.proficiency DESC', [user.id]);
  const [[profile]] = await pool.execute(
    `SELECT p.target_role, r.summary, r.experience_level FROM user_profiles p
       LEFT JOIN resumes r ON r.user_id=p.user_id AND r.is_active=1 WHERE p.user_id=? ORDER BY r.id DESC LIMIT 1`, [user.id]);
  let job = null, required = false, match = null;
  if (jobId) {
    const [[j]] = await pool.execute('SELECT id, title, company FROM jobs WHERE id=?', [jobId]);
    if (j) {
      job = j;
      const [[js]] = await pool.execute(
        'SELECT js.is_required FROM job_skills js JOIN skills s ON s.id=js.skill_id WHERE js.job_id=? AND s.skill_name=?', [j.id, skill]);
      required = Boolean(js && js.is_required);
      match = await latestMatchFor(user.id, j.id);
    }
  }
  return {
    skill, job, required, match,
    fullName: user.full_name, firstName: String(user.full_name || '').split(/\s+/)[0] || 'there',
    // Related skills (same category) first, so the tutor builds on the most relevant knowledge.
    userSkills: skills.map(s => s.name).filter(s => s !== skill)
      .sort((a, b) => (categoryOf(b) === categoryOf(skill)) - (categoryOf(a) === categoryOf(skill))),
    targetRole: profile?.target_role, level: profile?.experience_level, cvSummary: profile?.summary,
    resources: resourcesFor(skill),
  };
}

async function getProgress(userId, skill) {
  const [[row]] = await pool.execute(
    'SELECT id, completed_lessons, total_lessons, status FROM learning_progress WHERE user_id=? AND course_title=? ORDER BY id DESC LIMIT 1', [userId, skill]);
  return row || null;
}

async function setProgress(userId, skill, { completed, status }) {
  const existing = await getProgress(userId, skill);
  if (existing) {
    await pool.execute('UPDATE learning_progress SET completed_lessons=COALESCE(?, completed_lessons), status=COALESCE(?, status) WHERE id=?',
      [completed ?? null, status ?? null, existing.id]);
  } else {
    await pool.execute('INSERT INTO learning_progress(user_id, course_title, completed_lessons, total_lessons, status) VALUES(?,?,?,?,?)',
      [userId, skill, completed ?? 0, TOTAL_STEPS, status ?? 'in_progress']);
  }
  return getProgress(userId, skill);
}

async function history(userId, skill) {
  const [rows] = await pool.execute(
    'SELECT role, content, source, created_at FROM tutor_messages WHERE user_id=? AND skill_name=? ORDER BY id', [userId, skill]);
  return rows;
}

const saveMessage = (userId, skill, jobId, role, content, source = null) => pool.execute(
  'INSERT INTO tutor_messages(user_id, skill_name, job_id, role, content, source) VALUES(?,?,?,?,?,?)', [userId, skill, jobId || null, role, content, source]);

module.exports = function tutorRoutes(requireAuth) {
  const router = express.Router();
  const fail = (res, e) => {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ message: e.status ? e.message : 'The tutor could not respond. Please try again.' });
  };
  const skillParam = v => {
    const s = canonical(v);
    if (!s) throw Object.assign(new Error('Choose a skill to learn.'), { status: 400 });
    return s;
  };

  // Skill gaps across the user's latest matches, most valuable first.
  router.get('/tutor/gaps', requireAuth, async (req, res) => {
    try {
      const [[last]] = await pool.execute(
        'SELECT run_id FROM job_matches WHERE user_id=? AND run_id IS NOT NULL ORDER BY created_at DESC, id DESC LIMIT 1', [req.user.id]);
      const gaps = new Map();
      if (last) {
        const [rows] = await pool.execute(
          `SELECT m.job_id, m.match_percent, m.potential_percent, m.missing_skills, j.title, j.company
             FROM job_matches m JOIN jobs j ON j.id=m.job_id WHERE m.user_id=? AND m.run_id=? ORDER BY m.match_percent DESC`, [req.user.id, last.run_id]);
        for (const r of rows) {
          for (const miss of parse(r.missing_skills)) {
            const g = gaps.get(miss.name) || { skill: miss.name, category: categoryOf(miss.name), jobs: 0, required: 0, topJob: null };
            g.jobs++;
            if (miss.required) g.required++;
            if (!g.topJob) g.topJob = { id: r.job_id, title: r.title, company: r.company, fit: r.match_percent, potential: r.potential_percent };
            gaps.set(miss.name, g);
          }
        }
      }
      const [progress] = await pool.execute(
        'SELECT course_title, completed_lessons, total_lessons, status, updated_at FROM learning_progress WHERE user_id=? ORDER BY updated_at DESC', [req.user.id]);
      const prog = new Map(progress.map(p => [p.course_title, p]));
      const list = [...gaps.values()]
        .sort((a, b) => b.required - a.required || b.jobs - a.jobs)
        .map(g => ({ ...g, progress: prog.get(g.skill) || null }));
      const learned = progress.filter(p => p.status === 'completed').map(p => ({ skill: p.course_title, at: p.updated_at }));
      res.json({ gaps: list, learned, aiEnabled: ai.enabled() });
    } catch (e) { fail(res, e); }
  });

  // Open (or resume) a tutoring session for one skill.
  router.get('/tutor/session', requireAuth, async (req, res) => {
    try {
      const skill = skillParam(req.query.skill);
      const ctx = await buildContext(req.user, skill, req.query.job);
      let messages = await history(req.user.id, skill);
      if (!messages.length) {
        const { text, source } = await tutorTurn(ctx, [], null);
        await saveMessage(req.user.id, skill, ctx.job?.id, 'assistant', text, source);
        messages = await history(req.user.id, skill);
      }
      const progress = (await getProgress(req.user.id, skill)) || (await setProgress(req.user.id, skill, {}));
      res.json({ skill, job: ctx.job, required: ctx.required, match: ctx.match, resources: ctx.resources, messages, progress,
        aiEnabled: ai.enabled(), alreadyHas: false });
    } catch (e) { fail(res, e); }
  });

  router.post('/tutor/message', requireAuth, async (req, res) => {
    try {
      const skill = skillParam(req.body.skill);
      const message = String(req.body.message || '').trim().slice(0, 1500);
      if (!message) return res.status(400).json({ message: 'Type a message for the tutor.' });
      const ctx = await buildContext(req.user, skill, req.body.job);
      const prior = await history(req.user.id, skill);
      await saveMessage(req.user.id, skill, ctx.job?.id, 'user', message);
      const { text, source } = await tutorTurn(ctx, prior, message);
      await saveMessage(req.user.id, skill, ctx.job?.id, 'assistant', text, source);
      res.json({ reply: { role: 'assistant', content: text, source } });
    } catch (e) { fail(res, e); }
  });

  router.post('/tutor/progress', requireAuth, async (req, res) => {
    try {
      const skill = skillParam(req.body.skill);
      const completed = Math.max(0, Math.min(TOTAL_STEPS, Number(req.body.completed) || 0));
      res.json({ progress: await setProgress(req.user.id, skill, { completed, status: completed ? 'in_progress' : 'not_started' }) });
    } catch (e) { fail(res, e); }
  });

  // The learner says they now have the skill: add it to their profile and re-score their matches.
  router.post('/tutor/learned', requireAuth, async (req, res) => {
    try {
      const skill = skillParam(req.body.skill);
      const jobId = req.body.job ? Number(req.body.job) : null;
      const before = jobId ? await latestMatchFor(req.user.id, jobId) : null;
      await pool.execute('INSERT INTO skills(skill_name, category) VALUES(?, ?) ON DUPLICATE KEY UPDATE category=COALESCE(category, VALUES(category))', [skill, categoryOf(skill)]);
      const [[s]] = await pool.execute('SELECT id FROM skills WHERE skill_name=?', [skill]);
      await pool.execute('INSERT INTO user_skills(user_id, skill_id, proficiency, is_verified) VALUES(?,?,40,0) ON DUPLICATE KEY UPDATE proficiency=GREATEST(proficiency, 40)', [req.user.id, s.id]);
      const progress = await setProgress(req.user.id, skill, { completed: TOTAL_STEPS, status: 'completed' });
      const { runId } = await runMatching(req.user.id, { live: false });
      const after = jobId ? await latestMatchFor(req.user.id, jobId) : null;
      const note = `🎉 **${skill}** has been added to your profile and your job matches were re-scored.` +
        (before && after ? ` Your fit for this role went from **${before.fit}%** to **${after.fit}%**.` : '') +
        ' Keep the evidence: add your mini project to your CV so employers can see it.';
      await saveMessage(req.user.id, skill, jobId, 'assistant', note, 'system');
      res.json({ progress, runId, before, after, message: note });
    } catch (e) { fail(res, e); }
  });

  return router;
};
