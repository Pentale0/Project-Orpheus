let playlists = [];

function initPlaylists() {
  loadPlaylists();
}

async function loadPlaylists() {
  playlists = await window.db.getAllPlaylists();
  renderPlaylistList();
}

function renderPlaylistList() {
  const list = document.getElementById('playlistList');
  if (playlists.length === 0) {
    list.innerHTML = '<div style="padding: 8px; color: var(--text-muted); font-size: 14px; text-transform: uppercase;">No playlists</div>';
    return;
  }
  list.innerHTML = playlists.map(p => `<button class="nav-btn" style="font-size: 18px; padding: 8px 16px;">${escapeHtml(p.name)}</button>`).join('');
}
