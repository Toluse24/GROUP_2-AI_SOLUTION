// Dashboard: fills the signed-in home screen from /api/dashboard. Called by index.html after login.
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['#2c60bd', '#12a99f', '#f58a13', '#7c4dff', '#e0457b', '#0f9d58', '#455a80', '#c2410c'];
  const logoColor = n => COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  const fitColor = f => (f >= 75 ? '#0f9d58' : f >= 50 ? '#2864F6' : '#f08a24');
  const tutor = (skill, job) => `/ai-career-coach.html?skill=${encodeURIComponent(skill)}${job ? `&job=${job}` : ''}`;

  function ring(el, fit) {
    el.style.setProperty('--fit', `${fit}%`);
    el.style.setProperty('--ring', fitColor(fit));
  }

  window.loadDashboard = async function loadDashboard() {
    $('todayDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    let d;
    try {
      const res = await fetch('/api/dashboard', { credentials: 'same-origin' });
      if (!res.ok) return;
      d = await res.json();
    } catch (_) { return; }

    $('dashStatus').lastChild.textContent = d.hasCV ? 'CV active' : 'No CV yet';
    $('dashStatus').querySelector('.dot').style.background = d.hasCV ? '' : '#c3ccd9';
    $('dashRole').textContent = d.targetRole || (d.hasCV ? 'Career explorer' : 'New member');

    const empty = !d.best;
    $('dashEmpty').classList.toggle('hidden', !empty);
    $('dashBody').classList.toggle('hidden', empty);
    if (empty) {
      $('welcomeDesc').textContent = 'Upload your CV to see the jobs you fit and the skills to build next.';
      return;
    }

    const b = d.best, p = d.path;
    $('welcomeDesc').textContent = `You have ${d.strongMatches} strong match${d.strongMatches === 1 ? '' : 'es'} from ${d.jobCount} roles${d.targetRole ? ` for your ${d.targetRole} goal` : ''}.`;

    // stats
    $('statBest').textContent = `${b.fit}%`;
    $('statBestNote').textContent = d.bestDelta ? `${d.bestDelta > 0 ? '+' : ''}${d.bestDelta}% since your last match` : `${b.title} · ${b.company}`;
    const total = b.matched.length + b.missing.length;
    $('statSkills').textContent = `${b.matched.length} of ${total}`;
    $('statSkillsNote').textContent = `${Math.round((b.matched.length / (total || 1)) * 100)}% role ready · ${d.skillCount} skills on your profile`;
    $('statLearning').textContent = p ? `${p.percent}%` : '–';
    $('statLearningNote').textContent = p ? (p.remaining ? `${p.remaining} skill${p.remaining === 1 ? '' : 's'} left for ${p.job.company}` : 'Path complete 🎉') : 'No gaps to close';

    // top match
    $('bestLogo').textContent = b.company.trim()[0] || '?';
    $('bestLogo').style.background = logoColor(b.company);
    $('bestTitle').textContent = b.title;
    $('bestCompany').textContent = b.company;
    $('bestTags').innerHTML = [b.location, b.salary, b.jobType].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    $('bestFit').textContent = `${b.fit}%`;
    ring($('bestRing'), b.fit);
    $('bestOpen').href = `/search/search.html?job=${b.jobId}`;
    $('bestSkillHead').textContent = `${b.matched.length} matched · ${b.missing.length} to build`;
    $('bestSkills').innerHTML = b.matched.map(s => `<span class="skill">✓ ${esc(s)}</span>`).join('') +
      b.missing.map(m => `<a class="skill missing" href="${tutor(m.name, b.jobId)}" title="Learn with the AI tutor">+ ${esc(m.name)}</a>`).join('');

    // gap focus + path (both follow the learning-path job)
    if (p) {
      const open = p.modules.filter(m => m.state !== 'completed');
      $('gapSub').textContent = `For ${p.job.title} at ${p.job.company}`;
      $('gapCount').textContent = `${open.length} gap${open.length === 1 ? '' : 's'}`;
      $('gapList').innerHTML = p.modules.slice(0, 4).map((m, i) => {
        const pct = Math.round((m.stepsDone / m.steps) * 100);
        return `<a class="gap" href="${tutor(m.skill, p.job.id)}" style="text-decoration:none;color:inherit"><span class="num">${i + 1}</span>
          <div class="gapname"><strong>${esc(m.skill)}</strong><small>${m.state === 'completed' ? 'Learned ✓' : m.required ? 'High priority · must-have' : 'Nice to have'}</small></div>
          <div class="progress">${pct}%<div class="track"><i style="width:${pct}%"></i></div></div></a>`;
      }).join('') || '<p class="note">No gaps. You cover this role.</p>';
      const nextMod = open[0];
      $('gapCta').href = nextMod ? tutor(nextMod.skill, p.job.id) : '/ai-career-coach.html';
      $('gapCta').textContent = nextMod ? `✧ Continue with ${nextMod.skill} in your AI tutor →` : '✧ Open your AI tutor →';

      $('pathTitle').textContent = `${p.job.title} path`;
      $('pathDesc').textContent = open.length
        ? `Build the ${open.length} skill${open.length === 1 ? '' : 's'} between you and ${p.job.company}. Your fit could rise from ${p.job.fit}% to about ${p.job.potential}%.`
        : `You've closed every gap for ${p.job.company}. Time to apply!`;
      const label = { completed: '<span class="state done">✓ Learned</span>', in_progress: '▶ &nbsp;Continue learning', next: 'Start learning →', queued: 'Up next' };
      $('pathLessons').innerHTML = p.modules.slice(0, 3).map((m, i) => `<article class="lesson">
        <div class="lesson-top"><span class="lesson-num">${i + 1}</span>${m.stepsDone ? `<span class="badge">${Math.round((m.stepsDone / m.steps) * 100)}%</span>` : ''}</div>
        <h4>${esc(m.skill)}</h4><p>${m.steps} steps · ${m.required ? 'Must-have' : 'Nice to have'}</p>
        ${m.state === 'completed' ? label.completed : `<a href="${tutor(m.skill, p.job.id)}">${label[m.state]}</a>`}</article>`).join('');
    }
  };
})();
