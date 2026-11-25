// AI tutor page: pick a skill gap, chat with the tutor, track progress, mark the skill as learned.
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const params = new URLSearchParams(location.search);
  let current = { skill: params.get('skill'), job: params.get('job') };
  let gaps = [];

  // ---- tiny, safe Markdown: escape first, then add a few formats ----
  function inline(t) {
    return t
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function markdown(src) {
    const blocks = [];
    let text = esc(src).replace(/```[a-z]*\n?([\s\S]*?)```/g, (_, code) => { blocks.push(code.replace(/\n$/, '')); return `\u0000${blocks.length - 1}\u0000`; });
    const out = [];
    let list = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const line of text.split('\n')) {
      const ul = line.match(/^\s*[-•]\s+(.*)/), ol = line.match(/^\s*\d+\.\s+(.*)/);
      if (ul || ol) {
        const tag = ul ? 'ul' : 'ol';
        if (list !== tag) { close(); out.push(`<${tag}>`); list = tag; }
        out.push(`<li>${inline((ul || ol)[1])}</li>`);
      } else if (/^\s*$/.test(line)) { close(); }
      else if (/^\u0000\d+\u0000$/.test(line.trim())) { close(); out.push(line.trim()); }
      else { close(); out.push(`<p>${inline(line.replace(/^#{1,4}\s*/, ''))}</p>`); }
    }
    close();
    return out.join('').replace(/\u0000(\d+)\u0000/g, (_, i) => `<pre><code>${blocks[i]}</code></pre>`);
  }

  function addMessage(role, content, source) {
    const el = document.createElement('div');
    el.className = `message ${role === 'user' ? 'user-message' : 'coach-message'}`;
    if (role === 'user') el.textContent = content;
    else el.innerHTML = markdown(content) + (source === 'ai' ? '<span class="src-tag">✦ Grok AI</span>' : source === 'offline' ? '<span class="src-tag">Offline tutor</span>' : '');
    $('chatMessages').appendChild(el);
    $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
    return el;
  }

  function setFit(fit, potential) {
    const color = fit >= 75 ? '#0f9d58' : fit >= 50 ? '#2864b8' : '#f08a24';
    $('jobRing').style.setProperty('--fit', `${fit}%`);
    $('jobRing').style.setProperty('--ring', color);
    $('jobFit').textContent = `${fit}%`;
    $('fitNote').textContent = potential > fit ? `Your fit now is ${fit}%. Closing the must-have gaps for this role could raise it to about ${potential}%.` : `Your fit for this role is ${fit}%.`;
  }

  function setProgress(p) {
    const done = p?.completed_lessons || 0;
    $('progressLabel').textContent = p?.status === 'completed' ? 'Learned ✓' : `${done} of 4`;
    $('progressBar').style.width = `${(done / 4) * 100}%`;
    document.querySelectorAll('[data-step]').forEach(cb => { cb.checked = Number(cb.dataset.step) <= done; });
    const learned = p?.status === 'completed';
    $('learnedBtn').disabled = learned;
    $('learnedBtn').innerHTML = learned ? '✓ &nbsp;Skill learned' : '✓ &nbsp;Mark skill as learned';
  }

  function renderGaps() {
    if (!gaps.length) {
      $('gapList').innerHTML = '<p class="muted">No skill gaps found in your latest matches. Nice work! Refresh your matches on the Search page after updating your CV.</p>';
      return;
    }
    $('gapList').innerHTML = gaps.map(g => {
      const status = g.progress?.status;
      const badge = status === 'completed' ? '<span class="gap-badge done">Learned</span>' : status === 'in_progress' ? '<span class="gap-badge doing">In progress</span>' : g.required ? `<span class="gap-badge">Must-have · ${g.required}</span>` : '<span class="gap-badge">Nice to have</span>';
      return `<button type="button" class="gap-btn ${g.skill === current.skill ? 'active' : ''}" data-skill="${esc(g.skill)}" data-job="${g.topJob?.id || ''}">
        <span><strong>${esc(g.skill)}</strong><small>Needed by ${g.jobs} matched job${g.jobs === 1 ? '' : 's'}</small></span>${badge}</button>`;
    }).join('');
  }

  async function openSkill(skill, job) {
    current = { skill, job: job || null };
    history.replaceState(null, '', `?skill=${encodeURIComponent(skill)}${job ? `&job=${job}` : ''}`);
    renderGaps();
    $('chatMessages').innerHTML = '';
    const typing = addMessage('assistant', '*Preparing your lesson…*');
    typing.classList.add('typing');
    try {
      const s = await window.PIVOT.api(`/api/tutor/session?skill=${encodeURIComponent(skill)}${job ? `&job=${job}` : ''}`);
      $('chatMessages').innerHTML = '';
      s.messages.forEach(m => addMessage(m.role, m.content, m.source));
      $('lessonTitle').textContent = `Learn ${s.skill}`;
      $('lessonSub').textContent = s.job ? `${s.required ? 'A must-have' : 'A nice-to-have'} skill for ${s.job.title} at ${s.job.company}.` : 'Your tutor will teach this step by step.';
      $('chatTitle').textContent = `${s.skill} tutor`;
      $('jobCard').classList.toggle('hidden', !s.job);
      if (s.job) {
        $('jobTitle').textContent = s.job.title;
        $('jobMeta').textContent = s.job.company;
        if (s.match) setFit(s.match.fit, s.match.potential);
      }
      $('resourceList').innerHTML = s.resources.map(r => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener"><strong>${esc(r.title)} ↗</strong><small>${esc(r.provider)} · ${esc(r.type)} · Free</small></a></li>`).join('');
      ['progressCard', 'resourcesCard'].forEach(id => $(id).classList.remove('hidden'));
      $('learnedNote').classList.add('hidden');
      setProgress(s.progress);
      $('coachInput').disabled = $('sendBtn').disabled = false;
      $('coachInput').focus({ preventScroll: true });
    } catch (e) {
      $('chatMessages').innerHTML = '';
      addMessage('assistant', e.message);
    }
  }

  async function send(text) {
    const message = text.trim();
    if (!message || !current.skill) return;
    $('coachInput').value = '';
    addMessage('user', message);
    const typing = addMessage('assistant', '*Thinking…*');
    typing.classList.add('typing');
    try {
      const { reply } = await window.PIVOT.api('/api/tutor/message', { method: 'POST', body: JSON.stringify({ skill: current.skill, job: current.job, message }) });
      typing.remove();
      addMessage('assistant', reply.content, reply.source);
    } catch (e) {
      typing.remove();
      addMessage('assistant', e.message);
    }
  }

  // ---- events ----
  $('coachForm').addEventListener('submit', e => { e.preventDefault(); send($('coachInput').value); });
  document.querySelectorAll('.quick').forEach(b => b.addEventListener('click', () => send(b.dataset.ask)));
  $('gapList').addEventListener('click', e => {
    const b = e.target.closest('[data-skill]');
    if (b) openSkill(b.dataset.skill, b.dataset.job);
  });
  document.querySelectorAll('[data-step]').forEach(cb => cb.addEventListener('change', async () => {
    const completed = cb.checked ? Number(cb.dataset.step) : Number(cb.dataset.step) - 1;
    const { progress } = await window.PIVOT.api('/api/tutor/progress', { method: 'POST', body: JSON.stringify({ skill: current.skill, completed }) });
    setProgress(progress);
    const g = gaps.find(x => x.skill === current.skill);
    if (g) { g.progress = progress; renderGaps(); }
  }));
  $('learnedBtn').addEventListener('click', async () => {
    $('learnedBtn').disabled = true;
    $('learnedBtn').textContent = 'Updating your matches…';
    try {
      const r = await window.PIVOT.api('/api/tutor/learned', { method: 'POST', body: JSON.stringify({ skill: current.skill, job: current.job }) });
      setProgress(r.progress);
      if (r.after) setFit(r.after.fit, r.after.potential);
      addMessage('assistant', r.message, 'system');
      $('learnedNote').innerHTML = r.before && r.after
        ? `Fit for this role: <strong>${r.before.fit}% → ${r.after.fit}%</strong>. <a href="/search/search.html">See updated matches →</a>`
        : 'Added to your profile. <a href="/search/search.html">See updated matches →</a>';
      $('learnedNote').classList.remove('hidden');
      const g = gaps.find(x => x.skill === current.skill);
      if (g) { g.progress = r.progress; renderGaps(); }
      window.PIVOT.refreshShell();
    } catch (e) {
      alert(e.message);
      $('learnedBtn').disabled = false;
      $('learnedBtn').innerHTML = '✓ &nbsp;Mark skill as learned';
    }
  });

  // ---- start ----
  window.PIVOT.ready.then(async () => {
    const data = await window.PIVOT.api('/api/tutor/gaps');
    gaps = data.gaps;
    $('modeLabel').innerHTML = data.aiEnabled ? '✦ &nbsp;Powered by Grok AI' : '✧ &nbsp;Offline tutor mode';
    $('disclaimer').textContent = data.aiEnabled
      ? 'Lessons are generated by Grok using your CV and job matches. Learning links come from a curated list of free resources.'
      : 'Running in offline mode with built-in lessons. Add a Grok API key to get fully personalised AI tutoring.';
    renderGaps();
    if (!window.PIVOT.state?.skills?.length) {
      $('chatMessages').innerHTML = '<div class="empty-coach"><p>Upload your CV first so your tutor knows what you already know.</p><a href="/profile-resume/">Upload your CV →</a></div>';
      return;
    }
    if (current.skill) return openSkill(current.skill, current.job);
    if (gaps.length) return openSkill(gaps[0].skill, gaps[0].topJob?.id);
    $('chatMessages').innerHTML = '<div class="empty-coach"><p>No skill gaps to work on right now.</p><a href="/search/search.html">See your job matches →</a></div>';
  });
})();
