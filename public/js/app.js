import { api } from './api.js';
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist,
  moveInPlaylist,
  refreshState,
  removeFromPlaylist,
  renamePlaylist,
  resetStats,
  toggleInPlaylist,
  toggleLike
} from './playlists.js';
import {
  audioElement,
  bootPlayer,
  cycleRepeat,
  next,
  onPlayer,
  play,
  prev,
  seekTo,
  setVolume,
  toggle,
  toggleMute,
  toggleShuffle
} from './player.js';
import { S, ingest, track as getTrack } from './state.js';
import { contextIds, markCurrent, renderAll, renderQueue, renderTop, renderView, rescan, setCursor } from './views.js';
import { $, $$, bindBar, esc, fillIcons, fmt, fmtCount, ICON, toast } from './util.js';

const ROUTES = ['home', 'search', 'library', 'albums', 'artists', 'liked', 'stats'];

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [name, ...rest] = raw.split('/');
  return { name: name || 'home', param: rest.length ? decodeURIComponent(rest.join('/')) : '' };
}

function navigate(name, param) {
  const next = { name, param: param || '' };
  const hash = `#/${name}${next.param ? `/${encodeURIComponent(next.param)}` : ''}`;
  if (window.location.hash !== hash) window.location.hash = hash;
  S.route = next;
  $('#stage').scrollTop = 0;
  renderAll(true);
}

function onRouteChange() {
  const route = parseHash();
  if (route.name === S.route.name && route.param === S.route.param) return;
  S.route = route;
  $('#stage').scrollTop = 0;
  renderAll(true);
}

function visibleIds() {
  const ids = $$('.tr[data-id]')
    .map((row) => row.dataset.id)
    .filter((id) => S.tracks.has(id));
  return ids.length ? ids : S.ctx.slice();
}

function ctxFromAttr(value) {
  const ids = String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter((id) => S.tracks.has(id));
  return ids.length ? ids : visibleIds();
}

/* modal */
function openModal(modal) {
  S.modal = { ...modal, previous: document.activeElement };
  renderModal();
}

function closeModal() {
  const previous = S.modal && S.modal.previous;
  S.modal = null;
  renderModal();
  if (previous && previous.isConnected && previous.focus) previous.focus();
}

function renderModal() {
  const modal = S.modal;
  const host = $('#modal');
  if (!modal) {
    host.innerHTML = '';
    return;
  }
  let body = '';

  if (modal.type === 'add') {
    const track = getTrack(modal.trackId);
    if (!track) {
      closeModal();
      return;
    }
    const picks = S.playlists.length
      ? `<div class="picks">${S.playlists
          .map((p) => {
            const inside = p.tracks.includes(track.id);
            return `<button class="pick${inside ? ' is-in' : ''}" type="button" data-act="pick-pl" data-pid="${esc(p.id)}" aria-pressed="${inside}">
              <span>${esc(p.name)}</span><span>${inside ? 'Added' : `${p.tracks.length} track${p.tracks.length === 1 ? '' : 's'}`}</span></button>`;
          })
          .join('')}</div>`
      : '<p>No playlists yet. Create the first one below.</p>';
    body = `<h2>Add to playlist</h2>
      <p>${esc(track.title)} &middot; ${esc(track.artist)}</p>
      ${picks}
      <form class="inline" data-form="create-and-add">
        <label class="sr" for="modal-pl">New playlist name</label>
        <input class="field" id="modal-pl" maxlength="80" placeholder="New playlist name" autocomplete="off">
        <button class="btn primary" type="submit">Create &amp; add</button>
      </form>
      <div class="panel-f"><button class="btn" type="button" data-act="close-modal" data-autofocus>Done</button></div>`;
  } else if (modal.type === 'create') {
    body = `<h2>New playlist</h2>
      <form class="inline" data-form="create">
        <label class="sr" for="modal-pl">Playlist name</label>
        <input class="field" id="modal-pl" maxlength="80" placeholder="Late night drive" autocomplete="off" data-autofocus>
        <button class="btn primary" type="submit">Create</button>
      </form>
      <div class="panel-f"><button class="btn" type="button" data-act="close-modal">Cancel</button></div>`;
  } else if (modal.type === 'rename') {
    body = `<h2>Rename playlist</h2>
      <form class="inline" data-form="rename">
        <label class="sr" for="modal-pl">Playlist name</label>
        <input class="field" id="modal-pl" maxlength="80" value="${esc(modal.name || '')}" autocomplete="off" data-autofocus>
        <button class="btn primary" type="submit">Save</button>
      </form>
      <div class="panel-f"><button class="btn" type="button" data-act="close-modal">Cancel</button></div>`;
  } else if (modal.type === 'track') {
    const song = getTrack(modal.trackId);
    if (!song) {
      closeModal();
      return;
    }
    body = `<h2>Edit song</h2>
      <p>${esc(song.rel || '')}</p>
      <form data-form="track">
        <label class="sr" for="f-title">Title</label>
        <input class="field" id="f-title" value="${esc(song.title)}" placeholder="Title" autocomplete="off" data-autofocus>
        <label class="sr" for="f-artist">Artist</label>
        <input class="field" id="f-artist" value="${esc(song.artist)}" placeholder="Artist" autocomplete="off">
        <label class="sr" for="f-album">Album</label>
        <input class="field" id="f-album" value="${esc(song.album)}" placeholder="Album" autocomplete="off">
        <p>The file on disk is never renamed; only what Orpheus shows.</p>
        <div class="panel-f">
          <button class="btn primary" type="submit">Save</button>
          <button class="btn" type="button" data-act="close-modal">Cancel</button>
        </div>
      </form>`;
  } else if (modal.type === 'confirm') {
    body = `<h2>${esc(modal.title)}</h2>
      <p>${esc(modal.message)}</p>
      <div class="panel-f">
        <button class="btn danger" type="button" data-act="confirm-modal">${esc(modal.confirmLabel || 'Confirm')}</button>
        <button class="btn" type="button" data-act="close-modal" data-autofocus>Cancel</button>
      </div>`;
  }

  host.innerHTML = `<div class="scrim"><div class="panel" role="dialog" aria-modal="true" aria-label="${esc(modal.type)}">${body}</div></div>`;
  fillIcons(host);
  const focus = $('[data-autofocus]', host) || $('#modal-pl', host);
  if (focus) focus.focus();
}

function pick(event, selector) {
  const target = event.target instanceof Element ? event.target : null;
  return target ? target.closest(selector) : null;
}

/* actions */
async function act(node) {
  const kind = node.dataset.act;
  const id = node.dataset.id;

  switch (kind) {
    case 'row-play':
    case 'card-play':
    case 'queue-play': {
      const ids = kind === 'card-play' ? ctxFromAttr(node.dataset.ctx) : kind === 'queue-play' ? S.ctx.slice() : visibleIds();
      if (id === S.current) {
        toggle();
        return;
      }
      play(ids, id);
      return;
    }
    case 'play-context': {
      const ids = contextIds();
      play(ids, ids[0]);
      return;
    }
    case 'shuffle-context': {
      const ids = contextIds();
      if (!ids.length) return;
      play(ids, ids[Math.floor(Math.random() * ids.length)], { shuffle: true });
      return;
    }
    case 'like':
      await toggleLike(id);
      return;
    case 'add':
      openModal({ type: 'add', trackId: id });
      return;
    case 'edit':
      if (id) openModal({ type: 'track', trackId: id });
      return;
    case 'like-current':
      if (S.current) await toggleLike(S.current);
      return;
    case 'add-current':
      if (S.current) openModal({ type: 'add', trackId: S.current });
      return;
    case 'new-playlist':
      openModal({ type: 'create' });
      return;
    case 'rename-playlist':
      openModal({ type: 'rename', id: S.route.param, name: (S.playlists.find((p) => p.id === S.route.param) || {}).name });
      return;
    case 'delete-playlist':
      openModal({
        type: 'confirm',
        id: S.route.param,
        title: 'Delete playlist',
        message: `This removes "${(S.playlists.find((p) => p.id === S.route.param) || {}).name || 'it'}" only. The songs stay in your library.`,
        confirmLabel: 'Delete'
      });
      return;
    case 'confirm-modal': {
      const modal = S.modal;
      closeModal();
      if (!modal) return;
      if (modal.title === 'Delete playlist') {
        if (await deletePlaylist(modal.id)) navigate('home');
      } else if (modal.title === 'Reset play counts') {
        await resetStats();
      }
      return;
    }
    case 'pick-pl':
      if (S.modal) await toggleInPlaylist(node.dataset.pid, S.modal.trackId);
      renderModal();
      return;
    case 'move-up':
    case 'move-down': {
      const delta = kind === 'move-up' ? -1 : 1;
      const to = await moveInPlaylist(S.route.param, id, delta);
      if (to !== null) {
        S.cursor = to;
        renderView(false);
        setCursor(to, true);
      }
      return;
    }
    case 'remove-track':
      await removeFromPlaylist(S.route.param, id);
      renderView(false);
      return;
    case 'close-modal':
      closeModal();
      return;
    case 'rescan':
      await rescan();
      return;
    case 'reset-stats':
      openModal({
        type: 'confirm',
        title: 'Reset play counts',
        message: 'Every play count, listening total and history entry is cleared. Your music and playlists stay.',
        confirmLabel: 'Clear everything'
      });
      return;
    case 'toggle':
      toggle();
      return;
    case 'prev':
      prev();
      return;
    case 'next':
      next(false);
      return;
    case 'shuffle':
      toggleShuffle();
      renderView(false);
      return;
    case 'repeat':
      cycleRepeat();
      return;
    case 'mute':
      toggleMute();
      return;
    case 'queue':
      S.queueOpen = !S.queueOpen;
      $('#b-queue').setAttribute('aria-expanded', String(S.queueOpen));
      renderQueue();
      return;
    default:
  }
}

/* forms */
async function submitForm(form) {
  const input = $('#modal-pl', form);
  const value = input ? input.value : '';
  const kind = form.dataset.form;
  if (kind === 'create-and-add') {
    const list = await createPlaylist(value);
    if (!list) return;
    await addToPlaylist(list.id, S.modal.trackId);
    renderModal();
    return;
  }
  if (kind === 'create') {
    const list = await createPlaylist(value);
    if (!list) return;
    closeModal();
    renderView(false);
    navigate('playlist', list.id);
    return;
  }
  if (kind === 'track') {
    const trackId = S.modal.trackId;
    const patch = {
      title: $('#f-title').value,
      artist: $('#f-artist').value,
      album: $('#f-album').value
    };
    closeModal();
    try {
      await api.updateTrack(trackId, patch);
      await refreshState();
      toast('Song info saved.');
    } catch (err) {
      toast(`Save failed: ${err.message}`);
    }
    return;
  }
  if (kind === 'rename') {
    const id = S.modal.id;
    closeModal();
    await renamePlaylist(id, value);
  }
}

/* search */
function onSearch(value) {
  S.search = value;
  if (S.route.name !== 'library' && S.route.name !== 'search') {
    navigate('library');
    return;
  }
  renderView(false);
  setCursor(0, false);
  const field = $('#q');
  if (field) {
    field.focus();
    field.setSelectionRange(value.length, value.length);
  }
}

/* keyboard */
function stepRoute(delta) {
  const index = ROUTES.indexOf(S.route.name);
  const from = index >= 0 ? index : 0;
  navigate(ROUTES[(from + delta + ROUTES.length) % ROUTES.length]);
}

function onKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  const typing = target && target.matches && target.matches('input, select, textarea');

  if (S.modal) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    }
    return;
  }
  if (event.key === 'Escape') {
    if (typing) {
      target.blur();
      return;
    }
    if (S.search) {
      S.search = '';
      renderView(false);
      return;
    }
    if (S.route.name !== 'home') navigate('home');
    return;
  }
  if (typing) {
    if (event.key === 'Enter' && target.id === 'q' && S.rows.length) {
      event.preventDefault();
      play(visibleIds(), S.rows[0]);
    }
    return;
  }
  if (target.closest && target.closest('[role="slider"]')) return;
  const onButton = target.closest && target.closest('button');

  switch (event.key) {
    case ' ':
      if (!onButton) {
        event.preventDefault();
        toggle();
      }
      return;
    case 'ArrowDown':
      event.preventDefault();
      setCursor(S.cursor + 1, true);
      return;
    case 'ArrowUp':
      event.preventDefault();
      setCursor(S.cursor - 1, true);
      return;
    case 'Enter':
      if (!onButton && S.rows.length) {
        event.preventDefault();
        const id = S.rows[S.cursor];
        if (id) play(visibleIds(), id);
      }
      return;
    case 'ArrowRight':
      if (event.shiftKey) {
        event.preventDefault();
        next(false);
      }
      return;
    case 'ArrowLeft':
      if (event.shiftKey) {
        event.preventDefault();
        prev();
      }
      return;
    case '/':
      event.preventDefault();
      $('#q') ? $('#q').focus() : navigate('library');
      return;
    case 'q':
      stepRoute(-1);
      return;
    case 'e':
      stepRoute(1);
      return;
    default:
  }
}

/* boot */
async function boot() {
  fillIcons(document);
  bootPlayer();
  renderAll(false);

  bindBar($('#seek'), (fraction) => seekTo(fraction));
  bindBar($('#vol'), (fraction) => setVolume(fraction));
  $('#seek').addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const step = event.key === 'ArrowRight' ? 5 : -5;
    event.preventDefault();
    audioElement.currentTime = Math.min(Math.max(0, audioElement.currentTime + step), audioElement.duration || 0);
  });
  $('#vol').addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 0.05 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -0.05 : 0;
    if (!step) return;
    event.preventDefault();
    setVolume(S.volume + step);
  });

  onPlayer({
    track: () => {
      markCurrent();
      renderQueue();
    },
    update: () => {
      const current = getTrack(S.current);
      if (current) {
        const row = $(`.tr[data-id="${current.id}"]`);
        const cell = row && row.querySelector('.dur');
        if (cell && current.duration) cell.textContent = fmt(current.duration);
      }
      markCurrent();
    },
    plays: (track) => {
      const row = $(`.tr[data-id="${track.id}"]`);
      if (row) {
        const cell = row.querySelector('.num');
        if (cell) cell.innerHTML = track.plays ? fmtCount(track.plays) : '&middot;';
      }
      renderTop();
      renderQueue();
      if (S.route.name === 'stats') renderView(false);
    },
    state: () => {}
  });

  document.addEventListener('click', async (event) => {
    const nav = pick(event, '[data-nav]');
    if (nav) {
      navigate(nav.dataset.nav, nav.dataset.param);
      return;
    }
    const action = pick(event, '[data-act]');
    if (action) {
      await act(action);
      return;
    }
    if (event.target.classList && event.target.classList.contains('scrim')) {
      closeModal();
      return;
    }
    const row = pick(event, '.tr[data-id]');
    if (row) {
      setCursor(Number(row.dataset.i), false);
      play(visibleIds(), row.dataset.id);
    }
  });

  document.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitForm(event.target);
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'q') onSearch(event.target.value);
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'sort') {
      S.sort = event.target.value;
      renderView(true);
      setCursor(0, false);
    }
  });

  $('#stage').addEventListener('mousemove', (event) => {
    const row = event.target.closest && event.target.closest('.tr[data-i]');
    if (row && Number(row.dataset.i) !== S.cursor) setCursor(Number(row.dataset.i), false);
  });

  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', onRouteChange);

  try {
    const snapshot = await api.state();
    ingest(snapshot);
  } catch (err) {
    S.error = err.message;
    $('#view').innerHTML = `<div class="empty"><b>The Orpheus server is not answering</b><span>${esc(err.message)}</span><span>Start it with <code>npm start</code> in the project folder, then reload this page.</span></div>`;
    $('#top').innerHTML = '<div class="top-kind">Project Orpheus</div><h1 class="top-title">Offline</h1>';
    return;
  }

  const route = parseHash();
  S.route = route;
  renderAll(true);
  if (!S.tracks.size) {
    $('#view').innerHTML = `<div class="empty"><b>No music found</b>
      <span>Put mp3 files in a folder and point Orpheus at it, for example:</span>
      <span><code>set ORPHEUS_MUSIC_DIR=C:\\path\\to\\music</code></span>
      <span>then press Rescan folder. The folder currently watched is <code>${esc(S.folders.join(', ') || 'none')}</code>.</span>
      <button class="btn primary" type="button" data-act="rescan">${ICON.refresh} Rescan folder</button></div>`;
  }
}

boot();