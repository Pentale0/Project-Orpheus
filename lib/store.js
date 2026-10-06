import fsp from 'node:fs/promises';
import path from 'node:path';

const HISTORY_LIMIT = 400;

function emptyState() {
  return { version: 1, playlists: [], stats: {}, durations: {}, liked: {}, history: [] };
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class Store {
  constructor(file) {
    this.file = file;
    this.state = emptyState();
    this.timer = null;
    this.writing = null;
  }

  async load() {
    try {
      const raw = await fsp.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = { ...emptyState(), ...parsed };
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn('[store] starting fresh:', err.message);
      this.state = emptyState();
    }
    return this.state;
  }

  scheduleSave() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.save().catch((err) => console.error('[store] save failed:', err.message));
    }, 250);
    if (this.timer.unref) this.timer.unref();
  }

  async save() {
    if (this.writing) await this.writing.catch(() => {});
    const payload = JSON.stringify(this.state, null, 2);
    const tmp = `${this.file}.${process.pid}.tmp`;
    this.writing = (async () => {
      await fsp.mkdir(path.dirname(this.file), { recursive: true });
      await fsp.writeFile(tmp, payload, 'utf8');
      await fsp.rename(tmp, this.file);
    })();
    try {
      await this.writing;
    } finally {
      this.writing = null;
    }
  }

  statsFor(id) {
    let row = this.state.stats[id];
    if (!row) {
      row = { plays: 0, listenSec: 0, lastPlayed: 0 };
      this.state.stats[id] = row;
    }
    return row;
  }

  recordPlay(id, at) {
    const row = this.statsFor(id);
    row.plays += 1;
    row.lastPlayed = at;
    this.state.history.unshift({ id, at, plays: row.plays });
    if (this.state.history.length > HISTORY_LIMIT) this.state.history.length = HISTORY_LIMIT;
    this.scheduleSave();
    return row;
  }

  recordListen(id, sec, at) {
    const row = this.statsFor(id);
    row.listenSec += Math.max(0, Math.round(sec));
    if (at) row.lastPlayed = at;
    this.scheduleSave();
    return row;
  }

  setDuration(id, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return;
    this.state.durations[id] = Math.round(duration);
    this.scheduleSave();
  }

  toggleLiked(id) {
    if (this.state.liked[id]) delete this.state.liked[id];
    else this.state.liked[id] = Date.now();
    this.scheduleSave();
    return Boolean(this.state.liked[id]);
  }

  createPlaylist(name) {
    const now = Date.now();
    const list = { id: uid(), name: String(name || '').trim().slice(0, 80) || 'New playlist', tracks: [], created: now, updated: now };
    this.state.playlists.push(list);
    this.scheduleSave();
    return list;
  }

  getPlaylist(id) {
    return this.state.playlists.find((p) => p.id === id) || null;
  }

  updatePlaylist(id, patch) {
    const list = this.getPlaylist(id);
    if (!list) return null;
    if (typeof patch.name === 'string' && patch.name.trim()) list.name = patch.name.trim().slice(0, 80);
    if (Array.isArray(patch.tracks)) list.tracks = patch.tracks.filter((t) => typeof t === 'string').slice(0, 5000);
    list.updated = Date.now();
    this.scheduleSave();
    return list;
  }

  deletePlaylist(id) {
    const before = this.state.playlists.length;
    this.state.playlists = this.state.playlists.filter((p) => p.id !== id);
    if (this.state.playlists.length !== before) this.scheduleSave();
  }

  resetStats() {
    this.state.stats = {};
    this.state.history = [];
    this.scheduleSave();
  }
}