// Shared by every signed-in page: auth check + fills the user's name/initials in the shell.
(() => {
  const initialsOf = name => name.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'P';
  const setAll = (ids, text) => ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = text; });

  window.PIVOT = {
    ready: (async () => {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (res.status === 401) { window.location.href = '/'; return null; }
      if (!res.ok) return null;
      const { user } = await res.json();
      const name = (user.name || user.email || 'PIVOT User').trim();
      setAll(['sideName', 'sidebarName', 'profileName'], name);
      setAll(['sideInitials', 'sidebarInitials', 'profileInitials', 'topInitials'], initialsOf(name));
      window.PIVOT.user = user;
      return user;
    })(),
    // Small JSON helper used by page scripts.
    async api(url, options = {}) {
      const res = await fetch(url, { credentials: 'same-origin', ...options,
        headers: options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { window.location.href = '/'; throw new Error('Signed out'); }
      if (!res.ok) throw new Error(data.message || 'Something went wrong.');
      return data;
    },
  };
})();
