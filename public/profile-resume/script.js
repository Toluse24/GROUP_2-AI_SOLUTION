// Profile & Resume: upload a CV, show what was extracted, and let the user correct the skill list.
const $ = id => document.getElementById(id);
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const formatSize = b => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(2)} MB`);

function setMessage(text, ok = false) {
  $('uploadMessage').textContent = text;
  $('uploadMessage').classList.toggle('ok', ok);
}

function render(state) {
  const { resume, skills, profile } = state;
  $('targetRole').textContent = profile.target_role || 'Not set yet';

  if (resume) {
    $('fileName').textContent = resume.original_name;
    $('fileMeta').textContent = `${formatSize(resume.size_bytes)} · Uploaded ${new Date(resume.uploaded_at).toLocaleString()}`;
    $('fileBadge').textContent = 'Analysed';
    $('fileBadge').classList.remove('inactive');
    $('uploadLabel').textContent = 'Replace';
    $('summaryText').textContent = resume.summary || '';
    const viaAI = resume.extraction_source === 'ai';
    $('sourceTag').textContent = viaAI ? '✦ Extracted by Grok AI' : 'Extracted by offline keyword scan';
    $('sourceTag').classList.toggle('offline', !viaAI);
    $('cvSummary').classList.remove('hidden');
  }

  $('skillCount').textContent = skills.length ? `· ${skills.length}` : '';
  $('skillList').innerHTML = skills.length
    ? skills.map(s => `<span title="${escapeHtml(s.category)}">${escapeHtml(s.name)}<button type="button" data-remove="${escapeHtml(s.name)}" aria-label="Remove ${escapeHtml(s.name)}">×</button></span>`).join('')
    : '<p class="empty-skills">Upload your CV and your skills will appear here.</p>';
  $('matchCta').classList.toggle('hidden', !skills.length);
  window.PIVOT.refreshShell(state);
}

async function upload(file) {
  setMessage('');
  if (!/\.(pdf|docx?)$/i.test(file.name)) return setMessage('Please choose a PDF or DOCX file.');
  if (file.size > 5 * 1024 * 1024) return setMessage('The selected file is larger than the 5 MB limit.');

  $('fileRow').classList.add('busy');
  $('fileName').textContent = file.name;
  $('fileMeta').textContent = `${formatSize(file.size)} · Reading your CV and extracting skills…`;
  $('fileBadge').textContent = 'Analysing…';
  $('fileBadge').classList.remove('inactive');
  try {
    const body = new FormData();
    body.append('resume', file);
    const state = await window.PIVOT.api('/api/resume', { method: 'POST', body });
    render(state);
    setMessage(state.message, true);
  } catch (e) {
    setMessage(e.message);
    load();
  } finally {
    $('fileRow').classList.remove('busy');
    $('resumeInput').value = '';
  }
}

async function load() {
  const state = await window.PIVOT.api('/api/resume');
  render(state);
}

$('resumeInput').addEventListener('change', () => { const f = $('resumeInput').files[0]; if (f) upload(f); });

$('skillList').addEventListener('click', async e => {
  const name = e.target.dataset.remove;
  if (name) render(await window.PIVOT.api(`/api/skills/${encodeURIComponent(name)}`, { method: 'DELETE' }));
});

$('addSkillForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('newSkill').value.trim();
  if (!name) return;
  render(await window.PIVOT.api('/api/skills', { method: 'POST', body: JSON.stringify({ name }) }));
  $('newSkill').value = '';
});

$('editRole').addEventListener('click', async () => {
  const current = window.PIVOT.state?.profile?.target_role || '';
  const role = window.prompt('What role are you aiming for?', current);
  if (role === null) return;
  render(await window.PIVOT.api('/api/profile', { method: 'PUT', body: JSON.stringify({ target_role: role, location: window.PIVOT.state?.profile?.location }) }));
});

window.PIVOT.ready.then(load);
