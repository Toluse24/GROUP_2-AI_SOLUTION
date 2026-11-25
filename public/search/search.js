// Job Discovery: live matches for the signed-in user, job detail, saved jobs and match history.
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LOGO_COLORS = ['#2c60bd', '#12a99f', '#f58a13', '#7c4dff', '#e0457b', '#0f9d58', '#455a80', '#c2410c'];
  const logoColor = name => LOGO_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % LOGO_COLORS.length];
  const fitColor = fit => (fit >= 75 ? '#0f9d58' : fit >= 50 ? '#285fbd' : '#f08a24');
  const when = d => new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const tutorLink = (skill, jobId) => `/ai-career-coach.html?skill=${encodeURIComponent(skill)}&job=${jobId}`;
  const BOOKMARK = '<svg viewBox="0 0 24 24"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z"/></svg>';

  let state = { matches: [], runId: null, latestRunId: null, view: 'all' };

  function ring(fit, size = '') {
    return `<div class="match-ring ${size}" style="--match:${fit}%;--ring:${fitColor(fit)}"><span>${fit}%</span></div>`;
  }

  function card(m) {
    const needed = m.missing.filter(x => x.required).length;
    return `<article class="job-card" data-job="${m.jobId}" tabindex="0" role="button" aria-label="${esc(m.title)} at ${esc(m.company)}, ${m.fit}% fit">
      <div class="company-logo" style="background:${logoColor(m.company)}">${esc(m.company.trim()[0] || '?')}</div>
      <div class="job-details">
        <h3>${esc(m.title)} ${m.source === 'remotive' ? '<span class="src live">via Remotive</span>' : '<span class="src">Pivot partner</span>'}</h3>
        <p>${esc(m.company)} <span>•</span> ${esc(m.location || 'Location not stated')}</p>
        <small>${[m.salary, m.jobType].filter(Boolean).map(esc).join(' <span>•</span> ') || '&nbsp;'}</small>
        <div class="skill-line"><span class="ok">✓ ${m.matched.length} skills matched</span>${needed ? `<span class="gap">+ ${needed} to learn</span>` : '<span class="ok">All must-haves covered</span>'}</div>
      </div>
      ${ring(m.fit)}
      <button class="bookmark ${m.saved ? 'saved' : ''}" type="button" data-save="${m.jobId}" aria-pressed="${m.saved}" aria-label="Save ${esc(m.title)}">${BOOKMARK}</button>
    </article>`;
  }

  function renderList() {
    const q = $('jobSearch').value.trim().toLowerCase();
    let list = state.matches;
    if (state.view === 'saved') list = list.filter(m => m.saved);
    if (q) list = list.filter(m => [m.title, m.company, m.location, ...m.matched, ...m.missing.map(x => x.name)].join(' ').toLowerCase().includes(q));
    $('jobList').innerHTML = list.length
      ? list.map(card).join('')
      : `<p class="no-results">${state.view === 'saved' ? 'No saved jobs yet. Tap the bookmark on a job to keep it here.' : 'No jobs match your search. Try another role, company or skill.'}</p>`;
  }

  function showRun(data) {
    state.matches = data.matches;
    state.runId = data.runId;
    const viewingOld = state.latestRunId && data.runId !== state.latestRunId;
    $('historyBanner').classList.toggle('hidden', !viewingOld);
    if (viewingOld) $('historyBannerText').textContent = `Viewing your matches from ${when(data.ranAt)}.`;
    const skills = window.PIVOT.state?.skills?.length || 0;
    $('runInfo').textContent = data.ranAt
      ? `${data.matches.length} roles ranked against the ${skills} skills in your CV · matched ${when(data.ranAt)}`
      : 'Roles ranked against the skills in your CV.';
    renderList();
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
    const history = view === 'history';
    $('jobList').classList.toggle('hidden', history);
    $('historyList').classList.toggle('hidden', !history);
    document.querySelector('.search-box').classList.toggle('hidden', history);
    if (history) loadHistory(); else renderList();
  }

  async function loadHistory() {
    $('historyList').innerHTML = '<p class="no-results">Loading history…</p>';
    const { runs } = await window.PIVOT.api('/api/matches/history');
    $('historyList').innerHTML = runs.length ? runs.map((r, i) => `
      <button type="button" class="history-item" data-run="${r.runId}">
        <span class="h-date"><strong>${when(r.ranAt)}</strong><small>${i === 0 ? 'Latest · ' : ''}${esc(r.resumeName || 'Profile skills')}</small></span>
        <span class="h-top">${r.topJob ? `Top match: <b>${esc(r.topJob.title)}</b> at ${esc(r.topJob.company)}` : ''}<small>${r.jobCount} jobs · average fit ${r.avgFit}%</small></span>
        ${ring(r.bestFit, 'small')}
      </button>`).join('') : '<p class="no-results">No match history yet.</p>';
  }

  async function openJob(jobId) {
    const m = state.matches.find(x => String(x.jobId) === String(jobId));
    if (!m) return;
    $('drawerBody').innerHTML = '<p class="muted">Loading…</p>';
    $('drawer').classList.remove('hidden');
    $('drawerBackdrop').classList.remove('hidden');
    $('drawerClose').focus();
    let job = {};
    try { job = (await window.PIVOT.api(`/api/jobs/${jobId}`)).job; } catch (_) { /* fall back to card data */ }
    const missingReq = m.missing.filter(x => x.required), missingNice = m.missing.filter(x => !x.required);
    const gapItem = x => `<li><span><b>${esc(x.name)}</b><small>${x.required ? 'Must-have' : 'Nice to have'}</small></span><a class="learn" href="${tutorLink(x.name, m.jobId)}">Learn with AI tutor →</a></li>`;
    $('drawerBody').innerHTML = `
      <div class="d-head">
        <div class="company-logo" style="background:${logoColor(m.company)}">${esc(m.company.trim()[0] || '?')}</div>
        <div><h2 id="drawerTitle">${esc(m.title)}</h2><p>${esc(m.company)} · ${esc(m.location || '')}</p><small>${[m.salary, m.jobType].filter(Boolean).map(esc).join(' · ')}</small></div>
      </div>
      <div class="d-fit">${ring(m.fit, 'big')}<div><strong>Your fit for this role</strong><p>${esc(m.explanation)}</p>
        ${m.potential > m.fit ? `<div class="potential"><span style="width:${m.fit}%"></span><i style="left:${m.potential}%"></i></div><small>${m.fit}% now → about ${m.potential}% after closing the must-have gaps</small>` : ''}</div></div>
      <h4>Skills you already have <span>${m.matched.length}</span></h4>
      <div class="chips">${m.matched.map(s => `<span class="chip ok">✓ ${esc(s)}</span>`).join('') || '<span class="muted">None yet</span>'}</div>
      ${m.missing.length ? `<h4>Skill gaps to close <span>${m.missing.length}</span></h4><ul class="gaps">${missingReq.map(gapItem).join('')}${missingNice.map(gapItem).join('')}</ul>` : ''}
      ${job.description ? `<h4>About the role</h4><p class="desc">${esc(job.description.slice(0, 900))}${job.description.length > 900 ? '…' : ''}</p>` : ''}
      <div class="d-actions">
        ${m.url ? `<a class="primary" href="${esc(m.url)}" target="_blank" rel="noopener">View & apply on Remotive ↗</a>` : '<span class="muted">Pivot partner listing · applications open in the demo</span>'}
        ${m.missing.length ? `<a class="secondary" href="${tutorLink(m.missing[0].name, m.jobId)}">Start closing gaps</a>` : ''}
      </div>`;
  }

  function closeDrawer() {
    $('drawer').classList.add('hidden');
    $('drawerBackdrop').classList.add('hidden');
  }

  async function toggleSave(jobId, btn) {
    const m = state.matches.find(x => String(x.jobId) === String(jobId));
    const saved = !m.saved;
    m.saved = saved;
    btn.classList.toggle('saved', saved);
    btn.setAttribute('aria-pressed', saved);
    try { await window.PIVOT.api(`/api/matches/${jobId}/save`, { method: 'POST', body: JSON.stringify({ saved }) }); }
    catch (e) { m.saved = !saved; renderList(); alert(e.message); }
    if (state.view === 'saved') renderList();
  }

  async function refresh() {
    const btn = $('refreshBtn');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Matching…';
    try {
      const data = await window.PIVOT.api('/api/matches/run', { method: 'POST', body: '{}' });
      state.latestRunId = data.runId;
      setView('all');
      showRun(data);
    } catch (e) { alert(e.message); }
    finally { btn.disabled = false; btn.querySelector('span').textContent = 'Refresh matches'; }
  }

  // ---- events ----
  $('jobSearch').addEventListener('input', renderList);
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => setView(t.dataset.view)));
  $('refreshBtn').addEventListener('click', refresh);
  $('backToLatest').addEventListener('click', async () => showRun(await window.PIVOT.api('/api/matches')));
  $('jobList').addEventListener('click', e => {
    const save = e.target.closest('[data-save]');
    if (save) return toggleSave(save.dataset.save, save);
    const cardEl = e.target.closest('[data-job]');
    if (cardEl) openJob(cardEl.dataset.job);
  });
  $('jobList').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-job]')) { e.preventDefault(); openJob(e.target.dataset.job); }
  });
  $('historyList').addEventListener('click', async e => {
    const item = e.target.closest('[data-run]');
    if (!item) return;
    const data = await window.PIVOT.api(`/api/matches/run/${item.dataset.run}`);
    setView('all');
    showRun(data);
  });
  $('drawerClose').addEventListener('click', closeDrawer);
  $('drawerBackdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  // ---- start ----
  window.PIVOT.ready.then(async () => {
    if (!window.PIVOT.state?.skills?.length) {
      $('runInfo').textContent = 'Upload your CV and we will match you with jobs automatically.';
      $('jobList').innerHTML = '<div class="no-results empty-cta"><p>No CV yet, so there is nothing to match.</p><a href="/profile-resume/">Upload your CV →</a></div>';
      $('refreshBtn').disabled = true;
      return;
    }
    try {
      const data = await window.PIVOT.api('/api/matches');
      state.latestRunId = data.runId;
      showRun(data);
      const open = new URLSearchParams(location.search).get('job');
      if (open) openJob(open);
    } catch (e) {
      $('jobList').innerHTML = `<p class="no-results">${esc(e.message)}</p>`;
    }
  });
})();
