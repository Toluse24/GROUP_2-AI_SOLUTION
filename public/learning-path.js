async function loadProfile() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!response.ok) return;
    const data = await response.json();
    const user = data.user || {};
    const name = (user.name || user.email || 'PIVOT User').trim();
    const initials = name.split(/\\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'P';
    document.getElementById('sideName').textContent = name;
    document.getElementById('sideInitials').textContent = initials;
    document.getElementById('topInitials').textContent = initials;
  } catch (error) {
    console.warn('Could not load the signed-in profile:', error);
  }
}
loadProfile();

const moduleMessages = [
  'You are currently working on TypeScript Foundations.',
  'Working with REST APIs is your next module.',
  'Testing React with Jest is locked until the earlier modules are completed.'
];
document.querySelectorAll('.module').forEach((button, index) => {
  button.addEventListener('click', () => {
    const message = document.getElementById('moduleMessage');
    if (index === 2) {
      message.textContent = moduleMessages[index];
      return;
    }
    document.querySelectorAll('.module').forEach(item => item.classList.remove('active-module'));
    button.classList.add('active-module');
    message.textContent = moduleMessages[index];
  });
});
