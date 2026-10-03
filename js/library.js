let librarySongs = [];

function initLibrary() {
  loadLibrary();
}

async function loadLibrary() {
  librarySongs = await window.db.getAllSongs();
  renderLibrary();
}

function renderLibrary() {
  const container = document.getElementById('viewContent');
  if (librarySongs.length === 0) {
    container.innerHTML = '<div style="padding: 40px; color: var(--text-muted); text-transform: uppercase;">No songs imported yet. Click "IMPORT MP3S" to add your music.</div>';
    return;
  }
  
  const list = document.createElement('div');
  list.className = 'song-list';
  
  librarySongs.sort((a, b) => b.addedAt - a.addedAt).forEach((song, idx) => {
    const item = document.createElement('div');
    item.className = 'song-item' + (currentSong && currentSong.id === song.id ? ' selected playing' : '');
    item.dataset.songId = song.id;
    
    const cover = document.createElement('img');
    cover.className = 'song-cover';
    if (song.coverBlob) {
      cover.src = URL.createObjectURL(song.coverBlob);
    } else {
      cover.style.opacity = '0.3';
      cover.alt = '';
    }
    
    const info = document.createElement('div');
    info.className = 'song-info';
    info.innerHTML = `<div class="song-title">${escapeHtml(song.title)}</div><div class="song-artist">${escapeHtml(song.artist)}</div>`;
    
    const album = document.createElement('div');
    album.className = 'song-album';
    album.textContent = song.album;
    
    const duration = document.createElement('div');
    duration.className = 'song-duration';
    duration.textContent = formatTime(song.duration);
    
    item.appendChild(cover);
    item.appendChild(info);
    item.appendChild(album);
    item.appendChild(duration);
    
    item.addEventListener('click', () => {
      playSong(song);
      if (window.player.queue !== librarySongs) {
        window.player.queue = [...librarySongs];
        window.player.currentIndex = librarySongs.findIndex(s => s.id === song.id);
      }
      playBlip();
    });
    
    list.appendChild(item);
  });
  
  container.innerHTML = '';
  container.appendChild(list);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateSelection(songId) {
  $$('.song-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.songId === songId);
    item.classList.toggle('playing', item.dataset.songId === songId && isPlaying);
  });
}
