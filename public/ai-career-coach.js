// AI Career Coach demo interactions: rule-based responses, not a live AI connection.
(() => {
  const form = document.getElementById('coachForm');
  if (!form) return;
  const input = document.getElementById('coachInput');
  const messages = document.getElementById('chatMessages');
  const responses = [
    [/learning path|study|learn|typescript/i, 'A useful next step is to focus on TypeScript first, then REST APIs, and finally Jest testing. Start with the fundamentals, practise typing React props and state, and build a small project that consumes an API.'],
    [/resume|cv/i, 'To strengthen your resume, lead with your frontend projects, describe what you built and the technologies used, and include measurable outcomes where possible. Highlight HTML, CSS, JavaScript and React through your project examples.'],
    [/job|match|career/i, 'Your sample profile is aligned with a Junior Frontend Engineer role. To improve your match, build evidence of TypeScript, REST API integration and Jest testing through practical projects.'],
    [/interview/i, 'For a junior frontend interview, practise explaining the DOM, responsive CSS, JavaScript promises, React state and props, API requests, and how you debug code. Prepare one project you can explain from start to finish.']
  ];
  function addMessage(text, isUser) {
    const el = document.createElement('div');
    el.className = 'message ' + (isUser ? 'user-message' : 'coach-message');
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }
  function send(text) {
    const value = text.trim();
    if (!value) return;
    addMessage(value, true);
    input.value = '';
    const found = responses.find(([pattern]) => pattern.test(value));
    const answer = found ? found[1] : 'I can help with your learning path, resume improvement, job matches, and interview preparation. Which area would you like to focus on?';
    window.setTimeout(() => addMessage(answer, false), 250);
  }
  form.addEventListener('submit', event => { event.preventDefault(); send(input.value); });
  document.querySelectorAll('.suggestion').forEach(button => button.addEventListener('click', () => send(button.textContent)));
  document.getElementById('buildPathBtn').addEventListener('click', () => send('Create my learning path'));
  document.getElementById('openJobsBtn').addEventListener('click', () => send('Compare my job matches'));
})();
