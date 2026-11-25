// Jobs: curated seed data + live postings from Remotive (cached), and the deterministic fit-% engine.
const crypto = require('crypto');
const pool = require('./db');
const SEED = require('./seed-jobs');
const { findSkills, categoryOf } = require('./skills');

const REMOTIVE = 'https://remotive.com/api/remote-jobs';
const CACHE_HOURS = 6; // Remotive asks for at most ~4 fetches a day per query.
const LIVE_MAX_AGE_DAYS = 7;

// ---------- skills <-> DB ----------
const skillIds = new Map(); // skill name -> id; skills are never deleted, so this cache stays valid
async function skillId(conn, name) {
  if (skillIds.has(name)) return skillIds.get(name);
  await conn.execute('INSERT INTO skills(skill_name, category) VALUES(?, ?) ON DUPLICATE KEY UPDATE category=COALESCE(category, VALUES(category))', [name, categoryOf(name)]);
  const [[row]] = await conn.execute('SELECT id FROM skills WHERE skill_name=?', [name]);
  skillIds.set(name, row.id);
  return row.id;
}

async function upsertJob(conn, job, required, nice) {
  await conn.execute(
    `INSERT INTO jobs(external_id, source, title, company, location, job_type, salary, category, description, url, fetched_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE title=VALUES(title), company=VALUES(company), location=VALUES(location), job_type=VALUES(job_type),
       salary=VALUES(salary), category=VALUES(category), description=VALUES(description), url=VALUES(url), fetched_at=CURRENT_TIMESTAMP`,
    [job.external_id, job.source, job.title.slice(0, 190), job.company.slice(0, 190), (job.location || '').slice(0, 190) || null,
      job.job_type || null, (job.salary || '').slice(0, 120) || null, job.category || null, job.description || null, job.url || null]);
  const [[row]] = await conn.execute('SELECT id FROM jobs WHERE source=? AND external_id=?', [job.source, job.external_id]);
  await conn.execute('DELETE FROM job_skills WHERE job_id=?', [row.id]);
  const values = [];
  for (const name of required) values.push([row.id, await skillId(conn, name), 1]);
  for (const name of nice) values.push([row.id, await skillId(conn, name), 0]);
  if (values.length) await conn.query('INSERT IGNORE INTO job_skills(job_id, skill_id, is_required) VALUES ?', [values]);
  return row.id;
}

/** Insert/refresh the curated jobs. Runs on server start; cheap and idempotent. */
async function seedJobs() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const j of SEED) await upsertJob(conn, { ...j, external_id: j.id, source: 'seed', url: null }, j.required, j.nice);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ---------- live jobs (Remotive) ----------
const CATEGORY_TO_REMOTIVE = {
  Web: 'software-dev', Backend: 'software-dev', Programming: 'software-dev', Mobile: 'software-dev', Testing: 'qa', Tools: 'software-dev',
  DevOps: 'devops', Cloud: 'devops', Data: 'data', AI: 'data', Design: 'design', Product: 'product',
  Marketing: 'marketing', Sales: 'sales', Business: 'business', Finance: 'finance-legal', IT: 'customer-support',
};

const stripHtml = html => String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ').trim();

/** Pick a job's skills from Remotive's (noisy) tags, confirmed by the title/description. */
function skillsForLiveJob(raw, text) {
  const fromTags = findSkills((raw.tags || []).join(', '));
  const fromText = findSkills(`${raw.title} ${text}`);
  let skills = fromTags.filter(s => fromText.includes(s));
  if (skills.length < 3) skills = fromText;
  skills = skills.slice(0, 10);
  const head = `${raw.title} ${text.slice(0, 700)}`;
  const early = new Set(findSkills(head));
  let required = skills.filter(s => early.has(s));
  if (required.length < 3) required = skills.slice(0, Math.min(4, skills.length));
  return { required, nice: skills.filter(s => !required.includes(s)) };
}

async function cacheFresh(key) {
  const [[row]] = await pool.execute('SELECT fetched_at FROM api_cache WHERE cache_key=?', [key]);
  return row && Date.now() - new Date(row.fetched_at).getTime() < CACHE_HOURS * 3600 * 1000;
}

async function fetchRemotive(params) {
  const qs = new URLSearchParams({ limit: '40', ...params }).toString();
  const key = `remotive?${qs}`;
  if (await cacheFresh(key)) return { cached: true, added: 0 };
  const res = await fetch(`${REMOTIVE}?${qs}`, { signal: AbortSignal.timeout(9000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`);
  const { jobs = [] } = await res.json();
  const conn = await pool.getConnection();
  let added = 0;
  try {
    await conn.beginTransaction();
    for (const raw of jobs) {
      const text = stripHtml(raw.description);
      const { required, nice } = skillsForLiveJob(raw, text);
      if (required.length + nice.length < 3) continue; // can't score it meaningfully
      await upsertJob(conn, {
        external_id: String(raw.id), source: 'remotive', title: raw.title, company: raw.company_name,
        location: raw.candidate_required_location ? `Remote · ${raw.candidate_required_location}` : 'Remote',
        job_type: String(raw.job_type || '').replace(/_/g, '-').replace(/^\w/, c => c.toUpperCase()),
        salary: raw.salary, category: raw.category, description: text.slice(0, 2500), url: raw.url,
      }, required, nice);
      added++;
    }
    await conn.execute('INSERT INTO api_cache(cache_key, fetched_at) VALUES(?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE fetched_at=CURRENT_TIMESTAMP', [key]);
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
  return { cached: false, added };
}

/** Best-effort live refresh for this user's profile. Never throws. */
async function refreshLiveJobs(userSkills, targetRole) {
  const counts = {};
  userSkills.forEach(s => { const c = CATEGORY_TO_REMOTIVE[s.category]; if (c) counts[c] = (counts[c] || 0) + 1; });
  const category = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const search = roleTokens(targetRole).slice(-2).join(' ');
  const results = [];
  for (const params of [category && { category }, search && { search }].filter(Boolean)) {
    try { results.push({ params, ...(await fetchRemotive(params)) }); } catch (e) { results.push({ params, error: e.message }); }
  }
  return results;
}

// ---------- scoring ----------
const STOP = new Set(['junior', 'senior', 'lead', 'principal', 'jr', 'sr', 'entry', 'level', 'mid', 'associate', 'graduate', 'intern', 'i', 'ii', 'iii', 'the', 'of', 'and', 'a', 'remote', '-', '&']);
const roleTokens = role => String(role || '').toLowerCase().replace(/[^a-z0-9+#/ ]/g, ' ').split(/[\s/]+/)
  .map(t => t.replace(/^front$/, 'frontend').replace(/^back$/, 'backend')).filter(t => t && !STOP.has(t));

function roleSimilarity(targetRole, title) {
  const a = roleTokens(targetRole), b = new Set(roleTokens(title).map(t => t.replace(/-/g, '')));
  if (!a.length || !b.size) return 0;
  return a.filter(t => b.has(t.replace(/-/g, ''))).length / a.length;
}

/**
 * Fit % = 80% weighted skill coverage (must-have x2, nice-to-have x1) + 20% title similarity to the
 * user's target role, minus a seniority penalty when an entry/junior profile meets a senior/lead post.
 */
function scoreJob(job, userSkillSet, profile) {
  const req = job.skills.filter(s => s.required).map(s => s.name);
  const nice = job.skills.filter(s => !s.required).map(s => s.name);
  const has = s => userSkillSet.has(s.toLowerCase());
  const total = req.length * 2 + nice.length;
  const got = req.filter(has).length * 2 + nice.filter(has).length;
  const skillScore = total ? got / total : 0;
  const roleScore = roleSimilarity(profile.target_role, job.title);
  const junior = /entry|junior/i.test(profile.experience_level || '') || /junior|intern|graduate/i.test(profile.target_role || '');
  const penalty = junior && /\b(senior|sr\.?|lead|principal|staff|head|director)\b/i.test(job.title) ? 12 : 0;
  const fit = Math.round(Math.max(3, Math.min(98, 100 * (0.8 * skillScore + 0.2 * roleScore) - penalty)));
  // What the fit would be if every missing must-have skill were learned.
  const potential = Math.round(Math.min(98, 100 * (0.8 * (total ? (req.length * 2 + nice.filter(has).length) / total : 0) + 0.2 * roleScore) - penalty));
  const matched = [...req, ...nice].filter(has);
  const missing = [...req.filter(s => !has(s)).map(name => ({ name, required: true })), ...nice.filter(s => !has(s)).map(name => ({ name, required: false }))];
  const missingReq = missing.filter(m => m.required).map(m => m.name);
  const explanation = missingReq.length
    ? `You have ${matched.length} of ${req.length + nice.length} skills this role asks for. Learning ${listText(missingReq.slice(0, 3))} would lift your fit to about ${potential}%.`
    : `You cover every must-have skill for this role${missing.length ? `; ${listText(missing.slice(0, 2).map(m => m.name))} would make you stand out` : ''}.`;
  return { fit, potential, skillScore, roleScore, matched, missing, explanation };
}
const listText = a => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

async function loadJobsWithSkills() {
  const [jobs] = await pool.execute(
    `SELECT id, source, title, company, location, job_type, salary, category, url FROM jobs
      WHERE source='seed' OR fetched_at > (NOW() - INTERVAL ${LIVE_MAX_AGE_DAYS} DAY)`);
  const [skills] = await pool.execute(
    `SELECT js.job_id, s.skill_name AS name, js.is_required FROM job_skills js JOIN skills s ON s.id=js.skill_id`);
  const byJob = new Map(jobs.map(j => [j.id, { ...j, skills: [] }]));
  skills.forEach(s => byJob.get(s.job_id)?.skills.push({ name: s.name, required: Boolean(s.is_required) }));
  return [...byJob.values()].filter(j => j.skills.length >= 3);
}

async function userContext(userId) {
  const [skills] = await pool.execute(
    `SELECT s.skill_name AS name, COALESCE(s.category,'Other') AS category FROM user_skills us JOIN skills s ON s.id=us.skill_id WHERE us.user_id=?`, [userId]);
  const [[profile]] = await pool.execute(
    `SELECT p.target_role, r.experience_level, r.id AS resume_id FROM user_profiles p
       LEFT JOIN resumes r ON r.user_id=p.user_id AND r.is_active=1 WHERE p.user_id=? ORDER BY r.id DESC LIMIT 1`, [userId]);
  return { skills, profile: profile || {} };
}

/** Score every job for the user, store the top results as a new run (history), return the run. */
async function runMatching(userId, { live = true, limit = 15 } = {}) {
  const { skills, profile } = await userContext(userId);
  if (!skills.length) {
    const err = new Error('Upload your CV (or add skills on your profile) so we can match you with jobs.');
    err.status = 400;
    throw err;
  }
  const liveResult = live ? await refreshLiveJobs(skills, profile.target_role) : [];
  const userSet = new Set(skills.map(s => s.name.toLowerCase()));
  const scored = (await loadJobsWithSkills())
    .map(job => ({ job, ...scoreJob(job, userSet, profile) }))
    // Live postings are noisy: keep only those that are actually relevant to this person.
    .filter(r => r.job.source === 'seed' || r.roleScore > 0 || r.skillScore >= 0.5)
    .sort((a, b) => b.fit - a.fit || b.skillScore - a.skillScore)
    .slice(0, limit);

  const runId = crypto.randomBytes(8).toString('hex');
  const [savedRows] = await pool.execute('SELECT DISTINCT job_id FROM job_matches WHERE user_id=? AND is_saved=1', [userId]);
  const saved = new Set(savedRows.map(r => r.job_id));
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of scored) {
      await conn.execute(
        `INSERT INTO job_matches(run_id, user_id, job_id, resume_id, match_percent, potential_percent, matched_skills, missing_skills, explanation, is_saved)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
        [runId, userId, r.job.id, profile.resume_id || null, r.fit, r.potential, JSON.stringify(r.matched), JSON.stringify(r.missing),
          r.explanation.slice(0, 600), saved.has(r.job.id) ? 1 : 0]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return { runId, live: liveResult };
}

module.exports = { seedJobs, runMatching, scoreJob, roleSimilarity, refreshLiveJobs };
