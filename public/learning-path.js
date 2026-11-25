
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
