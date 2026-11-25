
// Frontend-only file selection. This does not upload the resume to the server.
const resumeInput = document.getElementById('resumeInput');
resumeInput.addEventListener('change', () => {
  const message = document.getElementById('uploadMessage');
  const file = resumeInput.files && resumeInput.files[0];
  message.textContent = '';

  if (!file) return;

  const allowed = /\.(pdf|doc|docx)$/i.test(file.name);
  if (!allowed) {
    message.textContent = 'Please choose a PDF, DOC, or DOCX file.';
    resumeInput.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    message.textContent = 'The selected file is larger than the 5 MB limit.';
    resumeInput.value = '';
    return;
  }

  const size = file.size < 1024 * 1024
    ? `${Math.max(1, Math.round(file.size / 1024))} KB`
    : `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileMeta').textContent = `${size} · Selected in this browser`;
  document.getElementById('fileBadge').textContent = 'Selected';
  document.getElementById('fileBadge').classList.remove('inactive');
  document.getElementById('privacyNote').textContent =
    'This file is selected in your browser only. It has not been uploaded to the PIVOT server.';
});

