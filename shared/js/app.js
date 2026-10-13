import { SONGS } from '../data/songs.js';
import { Playlists } from './playlists.js';
import { Theme } from './theme.js';
import { AudioPlayer } from './audio.js';
import { filterSongs } from './search.js';
import { el, qs, qsa, formatTime, setActiveView, trapFocus } from './ui.js';

const state = {
  currentPlaylistId: null,
  currentSongId: null,
  songs: SONGS,
  searchQuery: '',
  folderFilter: 'all',
  view: 'menu',
  menuIndex: 0,
  songIndex: 0,
  plIndex: 0,
  dialogFocus: 0,
};

const menuItems = ['Play', 'Collection', 'Settings', 'Quit'];
const dialogChoices = ['OK', 'Cancel'];

const player = new AudioPlayer((type) => {
  if (type === 'time' || type === 'play' || type === 'pause' || type === 'load') {
    renderNowPlaying();
  }
});

function init() {
  Theme.init();
  Playlists.load();
  setupMenu();
  setupCollection();
  setupPlaylistsUI();
  setupStats();
  setupSettings();
  setupDialog();
  setupKeyboardNav();
  setupNowPlaying();
  setupBackButtons();
  navigateTo('menu');
  renderAll();
}

function setupMenu() {
  const list = el('menuList');
  list.innerHTML = '';
  menuItems.forEach((label, idx) => {
    const btn = document.createElement('button');
    btn.className = 'menu-item';
    btn.dataset.index = String(idx);
    btn.innerHTML = `<span class="menu-label">${label}</span>`;
    btn.addEventListener('click', () => {
      state.menuIndex = idx;
      activateMenuItem();
      handleMenuAction(label);
    });
    btn.addEventListener('mouseenter', () => {
      state.menuIndex = idx;
      activateMenuItem();
    });
    list.appendChild(btn);
  });
  activateMenuItem();
}

function activateMenuItem() {
  qsa('#menuList .menu-item').forEach((b, i) => {
    b.classList.toggle('selected', i === state.menuIndex);
    if (i === state.menuIndex) b.focus();
  });
}

function handleMenuAction(label) {
  if (label === 'Play') {
    navigateTo('collection');
    renderCollection();
  } else if (label === 'Collection') {
    navigateTo('collection');
    renderCollection();
  } else if (label === '') {
    navigateTo('');
  } else if (label === 'Settings') {
    navigateTo('settings');
  } else if (label === 'Quit') {
    openDialog('Quit Orpheus?', 'Are you sure you want to quit?', ['OK', 'Cancel'], (idx) => {
      if (idx === 0) {
        // Desktop: window will be closed via main; web: just stay on menu
        try {
          if (window.electronAPI && window.electronAPI.quit) window.electronAPI.quit();
        } catch (e) {}
        // For web, do nothing special
      }
      closeDialog();
      navigateTo('menu');
      state.menuIndex = Math.max(0, menuItems.indexOf('Quit'));
      activateMenuItem();
    });
  }
}

function navigateTo(view) {
  // history
  if (!state._hist) state._hist = [];
  if (!state._histIdx) state._histIdx = -1;
  const last = state._hist[state._histIdx];
  if (last !== view) {
    state._histIdx++;
    state._hist.splice(state._histIdx, state._hist.length - state._histIdx, view);
  }
  state.view = view;
  setActiveView(view);
  updateNav();
  if (view === 'dialog') return;
}

function navigateBack() {
  if (!state._hist || state._histIdx <= 0) return;
  state._histIdx--;
  const v = state._hist[state._histIdx];
  state.view = v;
  setActiveView(v);
  updateNav();
}

function navigateForward() {
  if (!state._hist || state._histIdx >= state._hist.length - 1) return;
  state._histIdx++;
  const v = state._hist[state._histIdx];
  state.view = v;
  setActiveView(v);
  updateNav();
}

function setupKeyboardNav() {
  // sidebar nav
  qsa('.nav-btn').forEach((btn) => {
    if (btn.id === 'btnMenuToggle') return;
    btn.addEventListener('click', () => {
      const nv = btn.dataset.nav;
      if (nv === 'menu') navigateTo('menu');
      if (nv === 'collection') navigateTo('collection');
      if (nv === 'playlists') navigateTo('collection');
      if (nv === '') navigateTo('');
      if (nv === 'settings') navigateTo('settings');
      if (nv === 'stats') { renderStats(); navigateTo('stats'); }
      document.body.classList.remove('sidebar-open');
      updateNav();
    });
  });
  const btnToggle = el('btnMenuToggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });
  }
  document.addEventListener('keydown', (e) => {
    if (state.view === 'dialog') {
      handleDialogKeys(e);
      return;
    }
    if (state.view === 'menu') {
      handleMenuKeys(e);
      return;
    }
    if (state.view === 'collection' || state.view === 'playlist') {
      handleListKeys(e);
      return;
    }
  });
  // Spacebar toggles playback globally (capture so it wins over list activation)
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.code !== 'Space' && e.key !== ' ' && e.key !== 'Spacebar') return;
      const t = e.target;
      const tag = (t && t.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) {
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (player.current) {
        player.toggle();
      } else {
        const list = visibleSongs();
        if (list.length) playSong(list[0], list, 0);
      }
    },
    true
  );
  updateNav();
  const prev = el('navPrev');
  const next = el('navNext');
  if (prev) prev.onclick = () => navigateBack();
  if (next) next.onclick = () => navigateForward();
}

function updateNav() {
  qsa('.nav-btn').forEach((b) => {
    const nv = b.dataset.nav;
    let active = false;
    if (state.view === 'menu' && nv === 'menu') active = true;
    if ((state.view === 'collection' || state.view === 'playlist') && (nv === 'collection' || nv === 'playlists')) active = true;
    if (state.view === '' && nv === '') active = true;
    if (state.view === 'settings' && nv === 'settings') active = true;
    if (state.view === 'stats' && nv === 'stats') active = true;
    b.classList.toggle('active', active);
  });
}

function handleMenuKeys(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state.menuIndex = (state.menuIndex + 1) % menuItems.length;
    activateMenuItem();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    state.menuIndex = (state.menuIndex - 1 + menuItems.length) % menuItems.length;
    activateMenuItem();
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleMenuAction(menuItems[state.menuIndex]);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    navigateTo('menu');
  }
}

function setupCollection() {
  const search = el('songSearch');
  if (search) {
    search.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderCollection();
    });
  }
  const newPl = el('btnNewPlaylist');
  if (newPl) {
    newPl.addEventListener('click', () => {
      const name = prompt('Playlist name');
      if (name && name.trim()) {
        const pl = Playlists.create(name.trim(), []);
        renderPlaylists();
        // select it
        const pls = Playlists.getAll();
        const idx = pls.findIndex((p) => p.id === pl.id);
        state.plIndex = idx;
        renderPlaylists();
        navigateTo('collection');
      }
    });
  }
  qsa('#folderFilter .folder-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.folderFilter = btn.dataset.folder || 'all';
      state.songIndex = 0;
      qsa('#folderFilter .folder-btn').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      btn.setAttribute('aria-selected', 'true');
      qsa('#folderFilter .folder-btn').forEach((b) => {
        if (b !== btn) b.setAttribute('aria-selected', 'false');
      });
      renderSongs();
    });
  });
}

function visibleSongs() {
  const byFolder =
    state.folderFilter === 'all'
      ? state.songs
      : state.songs.filter((s) => s.folder === state.folderFilter);
  return filterSongs(byFolder, state.searchQuery);
}

function renderCollection() {
  renderSongs();
  renderPlaylists();
}

function renderSongs() {
  const list = el('songList');
  if (!list) return;
  list.innerHTML = '';
  const filtered = visibleSongs();
  filtered.forEach((song, idx) => {
    const item = document.createElement('div');
    item.className = 'song-item';
    item.tabIndex = 0;
    item.dataset.index = String(idx);
    item.innerHTML = `
      <img class="song-cover-sm" src="${song.cover}" alt="${song.title}">
      <div class="skew-fix">
        <div class="song-title">${escapeHtml(song.title)}</div>
        <div class="song-meta">${escapeHtml(song.artist)} • ${escapeHtml(song.album)}</div>
      </div>
      <div class="skew-fix song-meta">${formatTime(song.duration)}</div>
      <div class="skew-fix">
        
        <button class="btn" data-action="play">Play</button>
      </div>
    `;
    item.querySelector('[data-action="play"]').addEventListener('click', (e) => {
      e.stopPropagation();
      playSong(song, filtered, idx);
    });
    item.addEventListener('click', () => {
      state.songIndex = idx;
      highlightSongs();
    });
    item.addEventListener('dblclick', () => {
      playSong(song, filtered, idx);
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        playSong(song, filtered, idx);
      }
    });
    list.appendChild(item);
  });
  highlightSongs();
}

function highlightSongs() {
  qsa('#songList .song-item').forEach((el, i) => {
    el.classList.toggle('selected', i === state.songIndex);
  });
}

function handleListKeys(e) {
  if (state.view !== 'collection') return;
  const items = qsa('#songList .song-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (items.length === 0) return;
    state.songIndex = (state.songIndex + 1) % items.length;
    items[state.songIndex].focus();
    highlightSongs();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (items.length === 0) return;
    state.songIndex = (state.songIndex - 1 + items.length) % items.length;
    items[state.songIndex].focus();
    highlightSongs();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const filtered = visibleSongs();
    if (filtered[state.songIndex]) playSong(filtered[state.songIndex], filtered, state.songIndex);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    navigateTo('menu');
  } else if (e.key === 'a' || e.key === 'A') {
    // add to playlist shortcut
    const filtered = visibleSongs();
    if (filtered[state.songIndex]) addToPlaylist(filtered[state.songIndex].id);
  }
}

function playSong(song, list, idx) {
  state.currentSongId = song.id;
  player.setPlaylist(list, idx);
  player.play();
  renderNowPlaying();
}

function addToPlaylist(songId) {
  if (!songId) return;
  const pls = Playlists.getAll();
  if (pls.length === 0) {
    Playlists.create('My Playlist', [songId]);
    renderPlaylists();
    return;
  }
  const pl = pls[state.plIndex] || pls[0];
  Playlists.addSong(pl.id, songId);
  renderPlaylists();
}

function setupPlaylistsUI() {
  const list = el('playlistList');
  if (list) {
    list.addEventListener('keydown', (e) => {
      const items = qsa('#playlistList .playlist-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.plIndex = (state.plIndex + 1) % items.length;
        items[state.plIndex].focus();
        highlightPlaylists();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.plIndex = (state.plIndex - 1 + items.length) % items.length;
        items[state.plIndex].focus();
        highlightPlaylists();
      }
    });
  }
}

function renderPlaylists() {
  const list = el('playlistList');
  if (!list) return;
  list.innerHTML = '';
  const pls = Playlists.getAll();
  pls.forEach((pl, idx) => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.tabIndex = 0;
    item.dataset.index = String(idx);
    item.innerHTML = `<span class="skew-fix">${escapeHtml(pl.name)} (${pl.songIds.length})</span>
      <span class="skew-fix" style="margin-left:auto;display:flex;gap:0.4rem">
        <button class="btn" data-act="rename">Rename</button>
        <button class="btn" data-act="delete">Delete</button>
      </span>`;
    item.addEventListener('click', (e) => {
      // if clicking action buttons, don't open playlist view
      if (e.target.closest('[data-act]')) return;
      state.plIndex = idx;
      highlightPlaylists();
      showPlaylist(pl);
    });
    item.querySelector('[data-act="rename"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const nm = prompt('Rename playlist', pl.name);
      if (nm && nm.trim()) {
        Playlists.rename(pl.id, nm.trim());
        renderPlaylists();
      }
    });
    item.querySelector('[data-act="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openDialog('Delete Playlist', `Delete "${pl.name}"?`, ['Delete', 'Cancel'], (i) => {
        if (i === 0) {
          Playlists.delete(pl.id);
          state.plIndex = 0;
          renderPlaylists();
        }
        closeDialog();
      });
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        state.plIndex = idx;
        highlightPlaylists();
        showPlaylist(pl);
      }
    });
    list.appendChild(item);
  });
  highlightPlaylists();
}

function highlightPlaylists() {
  qsa('#playlistList .playlist-item').forEach((el, i) => {
    el.classList.toggle('selected', i === state.plIndex);
  });
}

function showPlaylist(pl) {
  const title = el('playlistTitle');
  const list = el('playlistSongs');
  if (title) title.textContent = pl.name;
  if (!list) return;
  list.innerHTML = '';
  pl.songIds.forEach((sid) => {
    const song = state.songs.find((s) => s.id === sid);
    if (!song) return;
    const item = document.createElement('div');
    item.className = 'song-item';
    item.innerHTML = `
      <img class="song-cover-sm" src="${song.cover}" alt="${song.title}">
      <div class="skew-fix">
        <div class="song-title">${escapeHtml(song.title)}</div>
        <div class="song-meta">${escapeHtml(song.artist)}</div>
      </div>
      <div class="skew-fix">
        <button class="btn" data-action="play">Play</button>
        <button class="btn" data-action="remove">Remove</button>
      </div>
    `;
    item.querySelector('[data-action="play"]').addEventListener('click', () => playSong(song, [song], 0));
    item.querySelector('[data-action="remove"]').addEventListener('click', () => {
      Playlists.removeSong(pl.id, sid);
      renderPlaylists();
      showPlaylist(pl);
    });
    list.appendChild(item);
  });
  navigateTo('playlist');
}

function setupStats() {
  renderStats();
}

function setupSettings() {
  const info = el('settingsInfo');
  if (info) {
    info.textContent = `Themes: P3R/P5R. Local only. Hardcoded songs: ${state.songs.length}. Playlists stored in localStorage.`;
  }
  const chk = el('chkAutoStart');
  if (chk) {
    // load state
    (async () => {
      if (window.electronAPI && window.electronAPI.getAutoStart) {
        const v = await window.electronAPI.getAutoStart();
        chk.checked = !!v;
      }
    })();
    chk.addEventListener('change', async () => {
      if (window.electronAPI && window.electronAPI.setAutoStart) {
        await window.electronAPI.setAutoStart(chk.checked);
      }
    });
  }
}

function setupDialog() {
  const backdrop = el('dialogBackdrop');
  const ok = el('dialogOk');
  const cancel = el('dialogCancel');
  if (ok)
    ok.addEventListener('click', () => {
      if (state._dialogCb) state._dialogCb(0);
    });
  if (cancel)
    cancel.addEventListener('click', () => {
      if (state._dialogCb) state._dialogCb(1);
      closeDialog();
    });
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeDialog();
    });
  }
}

function openDialog(title, msg, choices, cb) {
  el('dialogTitle').textContent = title;
  el('dialogMsg').textContent = msg;
  el('dialogOk').querySelector('.skew-fix').textContent = choices[0] || 'OK';
  el('dialogCancel').querySelector('.skew-fix').textContent = choices[1] || 'Cancel';
  state._dialogCb = cb;
  el('dialogBackdrop').classList.add('active');
  navigateTo('dialog');
  state.dialogFocus = 0;
  focusDialog();
}

function closeDialog() {
  el('dialogBackdrop').classList.remove('active');
  state._dialogCb = null;
}

function handleDialogKeys(e) {
  const btns = [el('dialogOk'), el('dialogCancel')];
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    state.dialogFocus = (state.dialogFocus + 1) % btns.length;
    focusDialog();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    state.dialogFocus = (state.dialogFocus - 1 + btns.length) % btns.length;
    focusDialog();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (state._dialogCb) state._dialogCb(state.dialogFocus);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeDialog();
    navigateTo('menu');
  }
}

function focusDialog() {
  const btns = [el('dialogOk'), el('dialogCancel')];
  btns.forEach((b, i) => b.classList.toggle('selected', i === state.dialogFocus));
  btns[state.dialogFocus].focus();
}

function setupNowPlaying() {
  const prev = el('npPrev');
  const play = el('npPlay');
  const next = el('npNext');
  const seek = el('npSeek');
  const vol = el('npVol');
  if (prev) prev.addEventListener('click', () => player.prev());
  if (play)
    play.addEventListener('click', () => {
      if (player.current) player.toggle();
      else {
        const filtered = visibleSongs();
        if (filtered.length) playSong(filtered[0], filtered, 0);
      }
    });
  if (next) next.addEventListener('click', () => player.next());
  if (seek)
    seek.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      player.seek(v);
    });
  if (vol)
    vol.addEventListener('input', (e) => {
      player.setVolume(Number(e.target.value) / 100);
      updateVolumeDisplay();
    });
  updateVolumeDisplay();
}

function updateVolumeDisplay() {
  const vol = player.getVolume();
  const slider = el('npVol');
  if (slider) slider.value = Math.round(vol * 100);
  const label = el('npVolLabel');
  if (label) label.textContent = Math.round(vol * 100) + '%';
}

function renderNowPlaying() {
  const song = player.current;
  if (song) {
    el('npCover').src = song.cover;
    el('npTitle').textContent = song.title;
    el('npArtist').textContent = song.artist;
  }
  const pb = el('npPlay').querySelector('.skew-fix');
  if (pb) pb.textContent = player.paused ? 'Play' : 'Pause';
  const cur = player.currentTime;
  const dur = player.duration;
  el('npCur').textContent = formatTime(cur);
  el('npDur').textContent = formatTime(dur);
  const seek = el('npSeek');
  seek.max = dur || 0;
  seek.value = cur;
  updateVolumeDisplay();
}

function renderAll() {
  renderCollection();
  renderPlaylists();
  renderNowPlaying();
}

function setupBackButtons() {
  const btnBackCollection = el('btnBackCollection');
  const btnBack = el('btnBack');
  const btnStats = el('btnStats');
  const btnStates = el('btnStates');
  const btnBackMenu = el('btnBackMenu');
  const btnBackStats = el('btnBackStats');
  const btnBackStates = el('btnBackStates');
  if (btnBackCollection) btnBackCollection.addEventListener('click', () => navigateTo('collection'));
  if (btnBack) btnBack.addEventListener('click', () => navigateTo('menu'));
  if (btnStats) btnStats.addEventListener('click', () => { renderStats(); navigateTo('stats'); });
  if (btnStates) btnStates.addEventListener('click', () => navigateTo('states'));
  if (btnBackMenu) btnBackMenu.addEventListener('click', () => navigateTo('menu'));
  if (btnBackStats) btnBackStats.addEventListener('click', () => navigateTo('settings'));
  if (btnBackStates) btnBackStates.addEventListener('click', () => navigateTo('settings'));
}

function renderStats() {
  const totalSongs = state.songs.length;
  const totalDur = state.songs.reduce((a, b) => a + (b.duration || 0), 0);
  const hrs = Math.floor(totalDur / 3600);
  const mins = Math.floor((totalDur % 3600) / 60);
  el('statSongs').textContent = totalSongs;
  el('statHours').textContent = hrs;
  el('statMins').textContent = mins;
  const fill1 = el('prog1');
  const fill2 = el('prog2');
  if (fill1) fill1.style.width = Math.min(100, totalSongs * 8) + '%';
  if (fill2) fill2.style.width = Math.min(100, (hrs + mins / 60) * 5) + '%';
  renderCalendar();
}

function renderCalendar() {
  const cal = el('calendar');
  const dStr = el('dateStr');
  if (!cal) return;
  cal.innerHTML = '';
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const days = last.getDate();
  const header = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  header.forEach((h) => {
    const c = document.createElement('div');
    c.className = 'cal-cell';
    c.textContent = h;
    cal.appendChild(c);
  });
  for (let i = 0; i < startDay; i++) {
    const c = document.createElement('div');
    c.className = 'cal-cell';
    cal.appendChild(c);
  }
  const today = now.getDate();
  for (let d = 1; d <= days; d++) {
    const c = document.createElement('div');
    c.className = 'cal-cell' + (d === today ? ' today' : '');
    c.textContent = d;
    cal.appendChild(c);
  }
  if (dStr) dStr.textContent = now.toLocaleDateString();
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}



