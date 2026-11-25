// Load the currently signed-in user's name from the existing PIVOT session endpoint.
async function loadProfile() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!response.ok) return;

    const data = await response.json();
    const user = data.user || {};
    const name = (user.name || user.fullName || user.email || 'PIVOT User').trim();
    const initials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'P';

    document.getElementById('sidebarName').textContent = name;
    document.getElementById('sidebarInitials').textContent = initials;
    document.getElementById('topInitials').textContent = initials;
    document.getElementById('profileName').textContent = name;
    document.getElementById('profileInitials').textContent = initials;
  } catch (error) {
    console.warn('Could not load the PIVOT profile:', error);
  }
}
loadProfile();

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

