// Dashboard summary + the learning path (the skill gaps for one chosen "path job").
const express = require('express');
const pool = require('../db');
const { resourcesFor } = require('../learning');

const parse = v => (typeof v === 'string' ? JSON.parse(v) : v || []);
const STEPS = 4;

async function latestRun(userId, offset = 0) {
  const [rows] = await pool.query(
    `SELECT run_id, MIN(created_at) AS ran_at FROM job_matches WHERE user_id=? AND run_id IS NOT NULL
      GROUP BY run_id ORDER BY ran_at DESC LIMIT 1 OFFSET ${Number(offset)}`, [userId]);
  return rows[0] || null;
}

async function runRows(userId, runId) {
  const [rows] = await pool.execute(
    `SELECT m.job_id, m.match_percent, m.potential_percent, m.matched_skills, m.missing_skills, m.is_saved,
            j.title, j.company, j.location, j.salary, j.job_type, j.source
       FROM job_matches m JOIN jobs j ON j.id=m.job_id WHERE m.user_id=? AND m.run_id=? ORDER BY m.match_percent DESC, m.id`, [userId, runId]);
  return rows.map(r => ({
    jobId: r.job_id, title: r.title, company: r.company, location: r.location, salary: r.salary, jobType: r.job_type, source: r.source,
    fit: r.match_percent, potential: r.potential_percent, matched: parse(r.matched_skills), missing: parse(r.missing_skills), saved: Boolean(r.is_saved),
  }));
}

/** The job the learning path aims at: the user's choice, else the best "stretch" role (biggest payoff from learning). */
function choosePathJob(rows, chosenId) {
  const chosen = rows.find(r => r.jobId === Number(chosenId));
  if (chosen) return chosen;
  const stretch = rows.filter(r => r.missing.some(m => m.required) && r.fit >= 40)
    .sort((a, b) => b.potential - a.potential || b.fit - a.fit)[0];
  return stretch || rows.find(r => r.missing.length) || rows[0] || null;
}

async function buildPath(userId, job) {
  if (!job) return null;
  const [progress] = await pool.execute(
    'SELECT course_title, completed_lessons, status FROM learning_progress WHERE user_id=?', [userId]);
  const prog = new Map(progress.map(p => [p.course_title, p]));
  const [jobSkills] = await pool.execute(
    'SELECT s.skill_name AS name, js.is_required FROM job_skills js JOIN skills s ON s.id=js.skill_id WHERE js.job_id=?', [job.jobId]);
  // Gaps still open, plus skills from this job the user has completed through the tutor.
  const learned = jobSkills.filter(s => prog.get(s.name)?.status === 'completed' && !job.missing.some(m => m.name === s.name))
    .map(s => ({ name: s.name, required: Boolean(s.is_required) }));
  const items = [...job.missing.filter(m => m.required), ...job.missing.filter(m => !m.required), ...learned];
  let nextAssigned = false;
  const modules = items.map(m => {
    const p = prog.get(m.name);
    const done = p?.status === 'completed' ? STEPS : p?.completed_lessons || 0;
    let state = done >= STEPS ? 'completed' : done > 0 || p?.status === 'in_progress' ? 'in_progress' : 'queued';
    if (state === 'queued' && !nextAssigned) { state = 'next'; nextAssigned = true; }
    if (state === 'in_progress') nextAssigned = true;
    return { skill: m.name, required: m.required, stepsDone: done, steps: STEPS, state, resource: resourcesFor(m.name)[0] };
  }).sort((a, b) => ({ completed: 0, in_progress: 1, next: 2, queued: 3 }[a.state] - { completed: 0, in_progress: 1, next: 2, queued: 3 }[b.state]));
  const totalSteps = modules.length * STEPS;
  const doneSteps = modules.reduce((n, m) => n + m.stepsDone, 0);
  return {
    job: { id: job.jobId, title: job.title, company: job.company, fit: job.fit, potential: job.potential },
    modules,
    percent: totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 100,
    remaining: modules.filter(m => m.state !== 'completed').length,
  };
}

module.exports = function dashboardRoutes(requireAuth) {
  const router = express.Router();

  router.get('/dashboard', requireAuth, async (req, res) => {
    try {
      const uid = req.user.id;
      const [[profile]] = await pool.execute(
        `SELECT p.target_role, p.path_job_id, r.id AS resume_id, r.original_name FROM user_profiles p
           LEFT JOIN resumes r ON r.user_id=p.user_id AND r.is_active=1 WHERE p.user_id=? ORDER BY r.id DESC LIMIT 1`, [uid]);
      const [[{ n: skillCount }]] = await pool.execute('SELECT COUNT(*) AS n FROM user_skills WHERE user_id=?', [uid]);
      const run = await latestRun(uid);
      if (!run) return res.json({ hasCV: Boolean(profile?.resume_id), skillCount, targetRole: profile?.target_role || null, best: null, path: null });

      const rows = await runRows(uid, run.run_id);
      const best = rows[0] || null;
      const prev = await latestRun(uid, 1);
      let bestDelta = null;
      if (prev && best) {
        const [[p]] = await pool.execute('SELECT MAX(match_percent) AS best FROM job_matches WHERE user_id=? AND run_id=?', [uid, prev.run_id]);
        bestDelta = p.best == null ? null : best.fit - p.best;
      }
      const [[counts]] = await pool.execute(
        `SELECT COUNT(DISTINCT run_id) AS runs, COUNT(DISTINCT CASE WHEN is_saved=1 THEN job_id END) AS saved FROM job_matches WHERE user_id=?`, [uid]);
      const pathJob = choosePathJob(rows, profile?.path_job_id);
      res.json({
        hasCV: Boolean(profile?.resume_id), resumeName: profile?.original_name || null, skillCount, targetRole: profile?.target_role || null,
        ranAt: run.ran_at, jobCount: rows.length, runs: counts.runs, saved: counts.saved, strongMatches: rows.filter(r => r.fit >= 70).length,
        best, bestDelta, path: await buildPath(uid, pathJob),
        pathOptions: rows.filter(r => r.missing.length || r.jobId === pathJob?.jobId).slice(0, 10)
          .map(r => ({ id: r.jobId, title: r.title, company: r.company, fit: r.fit })),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Could not load your dashboard.' });
    }
  });

  router.put('/path', requireAuth, async (req, res) => {
    const jobId = req.body.jobId ? Number(req.body.jobId) : null;
    await pool.execute('UPDATE user_profiles SET path_job_id=? WHERE user_id=?', [jobId, req.user.id]);
    res.json({ ok: true });
  });

  return router;
};
