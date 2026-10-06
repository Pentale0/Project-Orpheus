import { api } from './api.js';
import { S, track as getTrack } from './state.js';
import { $, artHTML, clamp, fmt, ICON, ls, shuffleList } from './util.js';

const audio = new Audio();
audio.preload = 'auto';

const PLAY_THRESHOLD_CAP = 30;
const PLAY_THRESHOLD_FLOOR = 5;
const LISTEN_FLUSH = 15;

let url = null;
let seq = 0;
let listened = 0;
let counted = false;
let pendingSec = 0;
let lastTime = 0;
let lastVolume = S.volume;

const hooks = {
  update: () => {},
  track: () => {},
  plays: () => {},
  state: () => {}
};

function threshold() {
  const current = getTrack(S.current);
  const duration = current ? current.duration || 0 : 0;
  return clamp(Math.min(PLAY_THRESHOLD_CAP, duration * 0.5), PLAY_THRESHOLD_FLOOR, PLAY_THRESHOLD_CAP);
}

function flushListen() {
  if (pendingSec < 1 || !S.current) {
    pendingSec = 0;
    return;
  }
  const sec = Math.round(pendingSec);
  pendingSec = 0;
  api.listen(S.current, sec).catch(() => {});
}

function setPlaying(playing) {
  S.playing = playing;
  document.documentElement.classList.toggle('is-playing', playing);
  const button = $('#b-play');
  button.innerHTML = playing ? ICON.pause : ICON.play;
  button.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  if (!playing) flushListen();
  hooks.state(playing);
}

function buildOrder(startId) {
  const base = S.ctx.filter((id) => S.tracks.has(id));
  if (S.shuffle) {
    const rest = shuffleList(base.filter((id) => id !== startId));
    S.order = startId ? [startId, ...rest] : rest;
    S.qi = startId ? 0 : -1;
  } else {
    S.order = base;
    S.qi = base.indexOf(startId);
  }
}

export function play(ids, startId, options = {}) {
  const list = (ids || []).filter((id) => S.tracks.has(id));
  if (!list.length) {
    toast('Nothing to play here yet.');
    return;
  }
  if (options.shuffle !== undefined) {
    S.shuffle = options.shuffle;
    ls.set('orpheus-shuffle', S.shuffle ? '1' : '0');
  }
  S.ctx = list.slice();
  const start = list.includes(startId) ? startId : list[0];
  buildOrder(start);
  load(start);
}

function load(id) {
  const current = seq + 1;
  seq = current;
  flushListen();
  const meta = getTrack(id);
  if (!meta) return;
  S.current = id;
  listened = 0;
  counted = false;
  lastTime = 0;
  if (url) URL.revokeObjectURL(url);
  url = new URL(meta.url, window.location.origin).href;
  audio.src = url;
  audio.load();
  setMediaSession(meta);
  renderBar();
  hooks.track(meta);
  const promise = audio.play();
  if (promise && promise.catch) {
    promise.catch((err) => {
      if (!err || err.name === 'AbortError') return;
      if (current !== seq) return;
      setPlaying(false);
      toast('Press play to start.');
    });
  }
}

export function toggle() {
  if (!S.current) {
    const first = S.rows[0];
    if (first) playIdsFromRows(first);
    else toast('This library is empty.');
    return;
  }
  if (audio.paused) {
    const promise = audio.play();
    if (promise && promise.catch) promise.catch(() => {});
  } else audio.pause();
}

function playIdsFromRows(id) {
  const ids = S.rows.includes(id) ? S.rows.slice() : [...S.ctx];
  play(ids, id);
}

export function next(auto = false) {
  if (!S.order.length) return;
  if (auto && S.repeat === 'one') {
    counted = false;
    listened = 0;
    audio.currentTime = 0;
    const promise = audio.play();
    if (promise && promise.catch) promise.catch(() => {});
    return;
  }
  let index = S.qi + 1;
  if (index >= S.order.length) {
    if (S.repeat === 'all' || !auto) index = 0;
    else {
      setPlaying(false);
      audio.currentTime = 0;
      return;
    }
  }
  S.qi = index;
  load(S.order[index]);
}

export function prev() {
  if (!S.order.length) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  let index = S.qi - 1;
  if (index < 0) index = S.order.length - 1;
  S.qi = index;
  load(S.order[index]);
}

export function toggleShuffle() {
  S.shuffle = !S.shuffle;
  ls.set('orpheus-shuffle', S.shuffle ? '1' : '0');
  if (S.current && S.order.length) {
    const base = S.ctx.filter((id) => S.tracks.has(id));
    if (S.shuffle) {
      S.order = [S.current, ...shuffleList(base.filter((id) => id !== S.current))];
      S.qi = 0;
    } else {
      S.order = base;
      S.qi = Math.max(0, base.indexOf(S.current));
    }
  }
  renderBar();
  hooks.update();
}

export function cycleRepeat() {
  S.repeat = S.repeat === 'off' ? 'all' : S.repeat === 'all' ? 'one' : 'off';
  ls.set('orpheus-repeat', S.repeat);
  renderBar();
}

export function seekTo(fraction) {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  if (!duration) return;
  audio.currentTime = clamp(fraction, 0, 1) * duration;
  paintProgress();
}

export function setVolume(value) {
  S.volume = clamp(value, 0, 1);
  audio.volume = S.volume;
  audio.muted = false;
  if (S.volume > 0) lastVolume = S.volume;
  ls.set('orpheus-vol', String(S.volume));
  paintVolume();
}

export function toggleMute() {
  if (audio.muted || audio.volume === 0) {
    audio.muted = false;
    setVolume(lastVolume || 0.8);
  } else {
    lastVolume = audio.volume;
    audio.muted = true;
    audio.volume = 0;
  }
  paintVolume();
}

function setMediaSession(meta) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      artwork: meta.cover ? [{ src: `/api/cover/${meta.id}`, sizes: '480x480' }] : []
    });
  } catch {
    /* unsupported */
  }
}

function renderBar() {
  const meta = getTrack(S.current);
  $('#np-title').textContent = meta ? meta.title : 'Nothing playing';
  $('#np-artist').textContent = meta ? `${meta.artist} · ${meta.plays} play${meta.plays === 1 ? '' : 's'}` : 'Pick a track to start';
  $('#np-art').innerHTML = artHTML(meta || { id: 'idle' });
  const like = $('#b-like');
  like.disabled = !meta;
  like.classList.toggle('on', Boolean(meta && meta.liked));
  $('#b-add').disabled = !meta;
  const shuffle = $('#b-shuffle');
  shuffle.classList.toggle('on', S.shuffle);
  shuffle.setAttribute('aria-pressed', String(S.shuffle));
  const repeat = $('#b-repeat');
  repeat.classList.toggle('on', S.repeat !== 'off');
  repeat.dataset.mode = S.repeat;
  repeat.setAttribute('aria-label', `Repeat: ${S.repeat}`);
  paintProgress();
  hooks.update();
}

function paintProgress() {
  const meta = getTrack(S.current);
  const duration = (Number.isFinite(audio.duration) && audio.duration) || (meta ? meta.duration : 0);
  const current = audio.currentTime || 0;
  $('#seek-fill').style.width = `${duration ? Math.min(100, (current / duration) * 100) : 0}%`;
  $('#t-cur').textContent = fmt(current);
  $('#t-dur').textContent = fmt(duration);
  const slider = $('#seek');
  slider.setAttribute('aria-valuenow', String(Math.round(current)));
  slider.setAttribute('aria-valuemax', String(Math.round(duration)));
}

function paintVolume() {
  const value = audio.muted ? 0 : audio.volume;
  $('#vol-fill').style.width = `${Math.round(value * 100)}%`;
  $('#vol').setAttribute('aria-valuenow', String(Math.round(value * 100)));
  $('#b-mute').innerHTML = value === 0 ? ICON.mute : ICON.vol;
}

function countPlay(id) {
  const meta = getTrack(id);
  if (!meta) return;
  meta.plays += 1;
  meta.lastPlayed = Date.now();
  S.totals.plays += 1;
  S.history.unshift({ id, at: Date.now(), plays: meta.plays });
  if (S.history.length > 400) S.history.length = 400;
  renderBar();
  hooks.plays(meta);
  api.play(id)
    .then((res) => {
      if (typeof res.plays === 'number') meta.plays = res.plays;
      hooks.plays(meta);
    })
    .catch(() => {});
}

audio.addEventListener('timeupdate', () => {
  const current = audio.currentTime;
  const delta = current - lastTime;
  lastTime = current;
  if (S.playing && delta > 0 && delta < 1.5) {
    listened += delta;
    pendingSec += delta;
  }
  if (pendingSec >= LISTEN_FLUSH) flushListen();
  if (!counted && S.current && listened >= threshold()) {
    counted = true;
    countPlay(S.current);
  }
  paintProgress();
});
audio.addEventListener('seeking', () => {
  lastTime = audio.currentTime;
  listened = 0;
});
audio.addEventListener('playing', () => {
  lastTime = audio.currentTime;
  setPlaying(true);
});
audio.addEventListener('pause', () => {
  lastTime = audio.currentTime;
  setPlaying(false);
});
audio.addEventListener('ended', () => {
  flushListen();
  next(true);
});
audio.addEventListener('loadedmetadata', () => {
  const meta = getTrack(S.current);
  if (!meta || !Number.isFinite(audio.duration)) return;
  const exact = Math.round(audio.duration);
  if (!meta.duration || Math.abs(meta.duration - exact) > 1.5) {
    meta.duration = exact;
    api.duration(meta.id, exact).catch(() => {});
    hooks.update();
  }
  paintProgress();
});
audio.addEventListener('error', () => {
  if (S.current && audio.src) toast('This file can not be played here.');
});
audio.addEventListener('volumechange', paintVolume);

try {
  if ('mediaSession' in navigator) {
    const handlers = { play: toggle, pause: toggle, previoustrack: () => prev(), nexttrack: () => next(false) };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* not supported */
      }
    }
  }
} catch {
  /* not supported */
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushListen();
});

export function bootPlayer() {
  const stored = parseFloat(ls.get('orpheus-vol'));
  S.volume = Number.isFinite(stored) ? clamp(stored, 0, 1) : 0.8;
  S.shuffle = ls.get('orpheus-shuffle') === '1';
  const repeat = ls.get('orpheus-repeat');
  S.repeat = repeat === 'all' || repeat === 'one' ? repeat : 'off';
  audio.volume = S.volume;
  paintVolume();
  renderBar();
}

export function onPlayer(handlers) {
  Object.assign(hooks, handlers);
}

export const audioElement = audio;