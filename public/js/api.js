async function request(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const message = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} ${message.slice(0, 120)}`.trim());
  }
  return res.status === 204 ? null : res.json();
}

const post = (url, body) => request(url, { method: 'POST', body: JSON.stringify(body || {}) });

export const api = {
  state: () => request('/api/state'),
  rescan: () => post('/api/rescan'),
  play: (id) => post('/api/play', { id }),
  listen: (id, sec) => post('/api/listen', { id, sec }),
  duration: (id, duration) => post('/api/duration', { id, duration }),
  like: (id) => post('/api/like', { id }),
  createPlaylist: (name) => post('/api/playlists', { name }),
  updateTrack: (id, patch) => request(`/api/track/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  updatePlaylist: (id, patch) => request(`/api/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deletePlaylist: (id) => request(`/api/playlists/${id}`, { method: 'DELETE' }),
  resetStats: () => post('/api/stats/reset')
};