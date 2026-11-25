// Job matches, match history, bookmarks and job detail.
const express = require('express');
const pool = require('../db');
const { runMatching } = require('../jobs');

const parse = v => (typeof v === 'string' ? JSON.parse(v) : v || []);

async function runResults(userId, runId) {
  const [rows] = await pool.execute(
    `SELECT m.job_id, m.match_percent, m.potential_percent, m.matched_skills, m.missing_skills, m.explanation, m.is_saved, m.created_at,
            j.title, j.company, j.location, j.job_type, j.salary, j.source, j.url
       FROM job_matches m JOIN jobs j ON j.id=m.job_id
      WHERE m.user_id=? AND m.run_id=? ORDER BY m.match_percent DESC, m.id`, [userId, runId]);
  return rows.map(r => ({
    jobId: r.job_id, title: r.title, company: r.company, location: r.location, jobType: r.job_type, salary: r.salary,
    source: r.source, url: r.url, fit: r.match_percent, potential: r.potential_percent, saved: Boolean(r.is_saved),
    matched: parse(r.matched_skills), missing: parse(r.missing_skills), explanation: r.explanation, createdAt: r.created_at,
  }));
}

async function latestRunId(userId) {
  const [[row]] = await pool.execute(
    'SELECT run_id FROM job_matches WHERE user_id=? AND run_id IS NOT NULL ORDER BY created_at DESC, id DESC LIMIT 1', [userId]);
  return row ? row.run_id : null;
}

async function runPayload(userId, runId, extra = {}) {
  const matches = await runResults(userId, runId);
  return { runId, ranAt: matches[0]?.createdAt || null, matches, ...extra };
}

module.exports = function matchRoutes(requireAuth) {
  const router = express.Router();
  const fail = (res, e) => {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ message: e.status ? e.message : 'Could not load job matches.' });
  };

  // Latest run; if the user has never been matched, run once now.
  router.get('/matches', requireAuth, async (req, res) => {
    try {
      let runId = await latestRunId(req.user.id);
      if (!runId) runId = (await runMatching(req.user.id)).runId;
      res.json(await runPayload(req.user.id, runId));
    } catch (e) { fail(res, e); }
  });

  router.post('/matches/run', requireAuth, async (req, res) => {
    try {
      const { runId, live } = await runMatching(req.user.id);
      res.status(201).json(await runPayload(req.user.id, runId, { live }));
    } catch (e) { fail(res, e); }
  });

  router.get('/matches/history', requireAuth, async (req, res) => {
    try {
      const [runs] = await pool.execute(
        `SELECT m.run_id, MIN(m.created_at) AS ran_at, COUNT(*) AS job_count, MAX(m.match_percent) AS best_fit,
                ROUND(AVG(m.match_percent)) AS avg_fit, MAX(r.original_name) AS resume_name
           FROM job_matches m LEFT JOIN resumes r ON r.id=m.resume_id
          WHERE m.user_id=? AND m.run_id IS NOT NULL GROUP BY m.run_id ORDER BY ran_at DESC LIMIT 30`, [req.user.id]);
      const out = [];
      for (const run of runs) {
        const [[top]] = await pool.execute(
          `SELECT j.title, j.company FROM job_matches m JOIN jobs j ON j.id=m.job_id WHERE m.run_id=? AND m.user_id=? ORDER BY m.match_percent DESC LIMIT 1`,
          [run.run_id, req.user.id]);
        out.push({ runId: run.run_id, ranAt: run.ran_at, jobCount: run.job_count, bestFit: run.best_fit, avgFit: Number(run.avg_fit),
          resumeName: run.resume_name, topJob: top || null });
      }
      res.json({ runs: out });
    } catch (e) { fail(res, e); }
  });

  router.get('/matches/run/:runId', requireAuth, async (req, res) => {
    try { res.json(await runPayload(req.user.id, req.params.runId)); } catch (e) { fail(res, e); }
  });

  router.post('/matches/:jobId/save', requireAuth, async (req, res) => {
    try {
      await pool.execute('UPDATE job_matches SET is_saved=? WHERE user_id=? AND job_id=?', [req.body.saved ? 1 : 0, req.user.id, req.params.jobId]);
      res.json({ saved: Boolean(req.body.saved) });
    } catch (e) { fail(res, e); }
  });

  // Job detail + this user's most recent match for it (used by the detail panel and the tutor).
  router.get('/jobs/:id', requireAuth, async (req, res) => {
    try {
      const [[job]] = await pool.execute('SELECT id, title, company, location, job_type, salary, source, url, description FROM jobs WHERE id=?', [req.params.id]);
      if (!job) return res.status(404).json({ message: 'Job not found.' });
      const [skills] = await pool.execute(
        'SELECT s.skill_name AS name, js.is_required AS required FROM job_skills js JOIN skills s ON s.id=js.skill_id WHERE js.job_id=? ORDER BY js.is_required DESC, s.skill_name', [job.id]);
      const [[m]] = await pool.execute(
        'SELECT match_percent, potential_percent, matched_skills, missing_skills, explanation, is_saved FROM job_matches WHERE user_id=? AND job_id=? ORDER BY id DESC LIMIT 1',
        [req.user.id, job.id]);
      res.json({
        job: { ...job, skills: skills.map(s => ({ name: s.name, required: Boolean(s.required) })) },
        match: m ? { fit: m.match_percent, potential: m.potential_percent, matched: parse(m.matched_skills), missing: parse(m.missing_skills),
          explanation: m.explanation, saved: Boolean(m.is_saved) } : null,
      });
    } catch (e) { fail(res, e); }
  });

  return router;
};
