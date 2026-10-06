import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseFilename, readTrackTags } from './id3.js';

const AUDIO_EXT = new Map([
  ['.mp3', 'audio/mpeg'],
  ['.m4a', 'audio/mp4'],
  ['.mp4', 'audio/mp4'],
  ['.aac', 'audio/aac'],
  ['.ogg', 'audio/ogg'],
  ['.oga', 'audio/ogg'],
  ['.opus', 'audio/ogg'],
  ['.wav', 'audio/wav'],
  ['.flac', 'audio/flac'],
  ['.webm', 'audio/webm']
]);

const COVER_CACHE_LIMIT = 300;

function idFor(relPath) {
  return crypto.createHash('sha1').update(relPath.toLowerCase()).digest('hex').slice(0, 16);
}

function exists(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function defaultDirs() {
  const fromEnv = (process.env.ORPHEUS_MUSIC_DIR || '')
    .split(path.delimiter)
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;

  const candidates = [
    path.join(process.cwd(), 'music'),
    path.join(os.homedir(), 'OneDrive', 'Desktop', 'Songs'),
    path.join(os.homedir(), 'Desktop', 'Songs'),
    path.join(os.homedir(), 'Music'),
    path.join(os.homedir(), 'Music', 'Music')
  ];
  return candidates.filter(exists);
}

export class Library {
  constructor(store, dirs, root) {
    this.store = store;
    this.root = root || process.cwd();
    this.dirs = dirs && dirs.length ? dirs : defaultDirs();
    this.tracks = new Map();
    this.covers = new Map();
    this.meta = {};
    this.scannedAt = 0;
    this.scanning = null;
  }

  loadMetadata() {
    this.meta = {};
    try {
      this.meta = JSON.parse(fs.readFileSync(path.join(this.root, 'metadata.json'), 'utf8'));
      if (!this.meta || typeof this.meta !== 'object') this.meta = {};
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn('[library] metadata.json unreadable:', err.message);
    }
  }

  async saveMetadata() {
    const file = path.join(this.root, 'metadata.json');
    const tmp = `${file}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(this.meta, null, 2), 'utf8');
    await fsp.rename(tmp, file);
  }

  applyMetadata(track) {
    const override = this.meta[track.rel] || {};
    const guessed = parseFilename(path.basename(track.file));
    track.title = override.title || track.title || guessed.title || path.basename(track.file, path.extname(track.file));
    track.artist = override.artist || track.artist || guessed.artist || 'Unknown artist';
    track.album = override.album || track.album || 'Singles';
    track.genre = override.genre || track.genre || '';
    track.year = override.year || track.year || '';
    if (override.track) track.trackNo = Number(override.track) || track.trackNo;
  }

  async updateTrack(id, patch) {
    const track = this.get(id);
    if (!track) return null;
    const allowed = ['title', 'artist', 'album', 'genre', 'year', 'track'];
    const record = { ...(this.meta[track.rel] || {}) };
    for (const key of allowed) {
      if (patch[key] !== undefined) record[key] = String(patch[key]).trim().slice(0, 200);
    }
    if (Object.values(record).some(Boolean)) this.meta[track.rel] = record;
    else delete this.meta[track.rel];

    let tags = {};
    try {
      tags = await readTrackTags(track.file, track.size);
    } catch {
      /* keep what we have */
    }
    track.title = tags.title || '';
    track.artist = tags.artist || '';
    track.album = tags.album || '';
    track.genre = tags.genre || '';
    track.year = tags.year || '';
    if (tags.track) track.trackNo = Number(tags.track) || track.trackNo;
    this.applyMetadata(track);

    try {
      await this.saveMetadata();
    } catch (err) {
      console.warn('[library] could not save metadata:', err.message);
    }
    return this.publicTrack(track);
  }

  get folders() {
    return this.dirs;
  }

  async files() {
    const found = [];
    const walk = async (dir, depth) => {
      if (depth > 8) return;
      let entries;
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full, depth + 1);
        else if (entry.isFile() && AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) found.push(full);
      }
    };
    for (const dir of this.dirs) await walk(dir, 0);
    found.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    return found;
  }

  async refresh() {
    if (this.scanning) return this.scanning;
    this.scanning = (async () => {
      this.loadMetadata();
      const files = await this.files();
      const next = new Map();
      for (const file of files) {
        const root = this.dirs.find((dir) => file.toLowerCase().startsWith(path.resolve(dir).toLowerCase()));
        const rel = path.relative(root || this.dirs[0] || path.dirname(file), file).replace(/\\/g, '/');
        const id = idFor(rel);
        let stat;
        try {
          stat = await fsp.stat(file);
        } catch {
          continue;
        }
        let tags = {};
        try {
          tags = await readTrackTags(file, stat.size);
        } catch (err) {
          console.warn('[library] unreadable tags:', path.basename(file), err.message);
        }
        const stats = this.store.statsFor(id);
        const record = {
          id,
          file,
          rel,
          mime: AUDIO_EXT.get(path.extname(file).toLowerCase()),
          title: tags.title || '',
          artist: tags.artist || '',
          album: tags.album || '',
          genre: tags.genre || '',
          year: tags.year || '',
          trackNo: tags.track || 0,
          duration: this.store.state.durations[id] || tags.duration || 0,
          size: stat.size,
          added: stat.mtimeMs,
          plays: stats.plays,
          listenSec: stats.listenSec,
          lastPlayed: stats.lastPlayed,
          liked: Boolean(this.store.state.liked[id]),
          cover: Boolean(tags.picture)
        };
        this.applyMetadata(record);
        next.set(id, record);
      }
      this.tracks = next;
      for (const key of [...this.covers.keys()]) if (!next.has(key)) this.covers.delete(key);
      this.scannedAt = Date.now();
      return this.tracks.size;
    })();
    try {
      return await this.scanning;
    } finally {
      this.scanning = null;
    }
  }

  get(id) {
    return this.tracks.get(id) || null;
  }

  all() {
    return [...this.tracks.values()];
  }

  syncStats(track) {
    const stats = this.store.statsFor(track.id);
    track.plays = stats.plays;
    track.listenSec = stats.listenSec;
    track.lastPlayed = stats.lastPlayed;
    track.liked = Boolean(this.store.state.liked[track.id]);
    if (!track.duration) track.duration = this.store.state.durations[track.id] || 0;
  }

  async cover(id) {
    if (this.covers.has(id)) return this.covers.get(id);
    const track = this.get(id);
    if (!track) return null;
    try {
      const tags = await readTrackTags(track.file, track.size);
      const pic = tags.picture ? { mime: tags.picture.mime, data: tags.picture.data } : null;
      if (this.covers.size >= COVER_CACHE_LIMIT) this.covers.delete(this.covers.keys().next().value);
      this.covers.set(id, pic);
      return pic;
    } catch {
      return null;
    }
  }

  publicTrack(track) {
    this.syncStats(track);
    return {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      genre: track.genre,
      year: track.year,
      trackNo: track.trackNo,
      duration: track.duration,
      size: track.size,
      added: track.added,
      plays: track.plays,
      listenSec: track.listenSec,
      lastPlayed: track.lastPlayed,
      liked: track.liked,
      cover: track.cover,
      url: `/api/audio/${track.id}`
    };
  }

  snapshot() {
    const tracks = this.all().map((t) => this.publicTrack(t));
    const playlists = this.store.state.playlists
      .slice()
      .sort((a, b) => a.created - b.created)
      .map((p) => ({
        ...p,
        tracks: p.tracks.filter((id) => this.tracks.has(id)),
        missing: p.tracks.length - p.tracks.filter((id) => this.tracks.has(id)).length
      }));
    const totals = tracks.reduce(
      (acc, t) => ({ plays: acc.plays + t.plays, listenSec: acc.listenSec + t.listenSec, size: acc.size + t.size }),
      { plays: 0, listenSec: 0, size: 0 }
    );
    const byArtist = new Map();
    for (const t of tracks) byArtist.set(t.artist, (byArtist.get(t.artist) || 0) + t.plays);
    return {
      tracks,
      playlists,
      liked: tracks.filter((t) => t.liked).map((t) => t.id),
      history: this.store.state.history,
      totals,
      artists: [...byArtist.entries()]
        .map(([name, plays]) => ({ name, plays }))
        .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name)),
      albums: this.albums(tracks),
      folders: this.dirs,
      scannedAt: this.scannedAt,
      online: true
    };
  }

  albums(tracks = this.all()) {
    const map = new Map();
    for (const track of tracks) {
      const key = `${track.artist}\u0000${track.album}`;
      let album = map.get(key);
      if (!album) {
        album = { key, artist: track.artist, name: track.album, year: track.year, cover: track.cover, ids: [], plays: 0, added: track.added };
        map.set(key, album);
      }
      album.ids.push(track.id);
      album.plays += track.plays;
      album.added = Math.max(album.added, track.added);
      album.cover = album.cover || track.cover;
      if (!album.year && track.year) album.year = track.year;
    }
    const list = [...map.values()];
    for (const album of list) {
      album.tracks = album.ids
        .map((id) => this.tracks.get(id))
        .filter(Boolean)
        .sort((a, b) => (a.trackNo || 999) - (b.trackNo || 999) || a.title.localeCompare(b.title))
        .map((t) => t.id);
    }
    return list.sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name));
  }
}