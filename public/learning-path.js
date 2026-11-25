// Learning Path: the skill gaps for one target job, as a curriculum that links into the AI tutor.
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tutor = (skill, job) => `/ai-career-coach.html?skill=${encodeURIComponent(skill)}&job=${job}`;
  const STATE = { completed: 'Learned ✓', in_progress: 'In progress', next: 'Start here', queued: 'Up next' };

  function render(d) {
    const p = d.path;
    if (!p) {
      $('pathTitle').textContent = 'Your learning path';
      $('pathIntro').textContent = '';
      $('pathEmpty').innerHTML = d.hasCV
        ? 'No skill gaps to close in your current matches. <a href="/search/search.html">Refresh your matches →</a>'
        : 'Upload your CV and Pivot will build a learning path from the skills your best-fit jobs ask for. <a href="/profile-resume/">Upload your CV →</a>';
      $('pathEmpty').classList.remove('hidden');
      return;
    }
    const open = p.modules.filter(m => m.state !== 'completed');
    $('pathTitle').textContent = `${p.job.title} Accelerator`;
    $('pathIntro').textContent = `Close your gaps for the ${p.job.title} role at ${p.job.company}.`;
    $('pathSelect').innerHTML = d.pathOptions.map(o => `<option value="${o.id}" ${o.id === p.job.id ? 'selected' : ''}>${esc(o.title)} · ${esc(o.company)} (${o.fit}%)</option>`).join('');
    $('pathPicker').classList.toggle('hidden', d.pathOptions.length < 2);

    $('curriculumSub').textContent = `${p.modules.length} skill${p.modules.length === 1 ? '' : 's'} · ${open.length} remaining · 4 steps each`;
    $('pathPercent').textContent = `${p.percent}%`;
    $('pathBar').style.width = `${p.percent}%`;
    $('moduleList').innerHTML = p.modules.map(m => `
      <a class="module ${m.state === 'in_progress' || m.state === 'next' ? 'active-module' : ''}" href="${tutor(m.skill, p.job.id)}">
        <span class="module-icon ${m.state === 'completed' ? 'done' : m.state === 'in_progress' ? 'play' : ''}">${m.state === 'completed' ? '✓' : m.state === 'in_progress' ? '▶' : '&lt;/&gt;'}</span>
        <span class="module-copy"><strong>${esc(m.skill)}</strong><small>${m.stepsDone}/${m.steps} steps · ${m.required ? 'Must-have' : 'Nice to have'}</small></span>
        <span class="module-state ${m.state}">${STATE[m.state]}</span></a>`).join('');
    const current = p.modules.find(m => m.state === 'in_progress') || p.modules.find(m => m.state === 'next');
    $('moduleMessage').textContent = current ? `Next: open ${current.skill} to continue with your AI tutor.` : 'Every skill on this path is learned. Time to apply!';

    $('outcomeText').textContent = open.length
      ? `Completing this path is projected to raise your ${p.job.company} match from ${p.job.fit}% to about ${p.job.potential}%.`
      : `You've completed this path. Your ${p.job.company} match is now ${p.job.fit}%.`;
    $('gainTags').innerHTML = p.modules.map(m => `<span>${esc(m.skill)}</span>`).join('');
    $('resourceList').innerHTML = p.modules.slice(0, 4).map(m => `<a class="resource" href="${esc(m.resource.url)}" target="_blank" rel="noopener">
      <span><strong>${esc(m.resource.title)}</strong><small>${esc(m.skill)} · ${esc(m.resource.provider)}</small></span><b>→</b></a>`).join('');
    $('pathGrid').classList.remove('hidden');
  }

  async function load() {
    render(await window.PIVOT.api('/api/dashboard'));
  }

  $('pathSelect').addEventListener('change', async () => {
    await window.PIVOT.api('/api/path', { method: 'PUT', body: JSON.stringify({ jobId: $('pathSelect').value }) });
    load();
  });

  window.PIVOT.ready.then(load);
})();
