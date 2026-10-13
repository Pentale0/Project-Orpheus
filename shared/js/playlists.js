import {
  PLAYLISTS,
  createPlaylist as cp,
  addSongToPlaylist as asp,
  removeSongFromPlaylist as rsp,
  renamePlaylist as rnp,
  deletePlaylist as dp,
} from '../data/playlists.js';

export const Playlists = {
  getAll() {
    return PLAYLISTS;
  },
  get(id) {
    return PLAYLISTS.find((p) => p.id === id) || null;
  },
  create(name, songIds = []) {
    const pl = cp(name || 'New Playlist', songIds);
    this._persist();
    return pl;
  },
  addSong(pid, sid) {
    const res = asp(pid, sid);
    if (res) this._persist();
    return res;
  },
  removeSong(pid, sid) {
    const res = rsp(pid, sid);
    if (res) this._persist();
    return res;
  },
  rename(pid, name) {
    const res = rnp(pid, name);
    if (res) this._persist();
    return res;
  },
  delete(pid) {
    const ok = dp(pid);
    if (ok) this._persist();
    return ok;
  },
  load() {
    try {
      const raw = localStorage.getItem('orpheus:playlists');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          PLAYLISTS.length = 0;
          arr.forEach((p) => PLAYLISTS.push(p));
        }
      }
    } catch (e) {}
  },
  _persist() {
    try {
      localStorage.setItem('orpheus:playlists', JSON.stringify(PLAYLISTS));
    } catch (e) {}
  },
};
