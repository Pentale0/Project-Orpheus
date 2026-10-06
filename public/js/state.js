import { groupBy } from './util.js';

export const S = {
  ready: false,
  online: true,
  error: '',
  folders: [],
  scannedAt: 0,
  tracks: new Map(),
  playlists: [],
  albums: [],
  artists: [],
  history: [],
  totals: { plays: 0, listenSec: 0, size: 0 },
  route: { name: 'home', param: '' },
  search: '',
  sort: 'added',
  rows: [],
  cursor: 0,
  playing: false,
  current: null,
  ctx: [],
  order: [],
  qi: -1,
  shuffle: false,
  repeat: 'off',
  volume: 0.8,
  queueOpen: false,
  modal: null
};

export function allTracks() {
  return [...S.tracks.values()];
}

export function tracksOf(ids) {
  return (ids || []).map((id) => S.tracks.get(id)).filter(Boolean);
}

export function track(id) {
  return S.tracks.get(id) || null;
}

export function ingest(snapshot) {
  S.tracks = new Map(snapshot.tracks.map((t) => [t.id, t]));
  S.playlists = snapshot.playlists;
  S.albums = snapshot.albums;
  S.artists = snapshot.artists;
  S.history = snapshot.history;
  S.totals = snapshot.totals;
  S.folders = snapshot.folders || [];
  S.scannedAt = snapshot.scannedAt;
  S.ready = true;
  S.order = S.order.filter((id) => S.tracks.has(id));
  S.ctx = S.ctx.filter((id) => S.tracks.has(id));
  if (S.current && !S.tracks.has(S.current)) S.current = null;
}

export function sortTracks(list) {
  const by = {
    added: (a, b) => b.added - a.added,
    title: (a, b) => a.title.localeCompare(b.title),
    artist: (a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title),
    album: (a, b) => a.album.localeCompare(b.album) || (a.trackNo || 0) - (b.trackNo || 0),
    plays: (a, b) => b.plays - a.plays || a.title.localeCompare(b.title),
    duration: (a, b) => b.duration - a.duration
  }[S.sort];
  return list.slice().sort(by || by.added);
}

export function libraryTracks() {
  const q = S.search.trim().toLowerCase();
  let list = allTracks();
  if (q) list = list.filter((t) => `${t.title} ${t.artist} ${t.album} ${t.genre}`.toLowerCase().includes(q));
  return sortTracks(list);
}

export function topTracks(limit = 10) {
  return allTracks().filter((t) => t.plays > 0).sort((a, b) => b.plays - a.plays || b.lastPlayed - a.lastPlayed).slice(0, limit);
}

export function recentTracks(limit = 12) {
  return allTracks().filter((t) => t.lastPlayed > 0).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, limit);
}

export function newTracks(limit = 12) {
  return allTracks().sort((a, b) => b.added - a.added).slice(0, limit);
}

export function likedTracks() {
  return sortTracks(allTracks().filter((t) => t.liked));
}

export function albumByKey(key) {
  return S.albums.find((a) => a.key === key) || null;
}

export function playlistsWithMeta() {
  const byArtist = groupBy(allTracks(), (t) => t.artist);
  return S.playlists.map((p) => {
    const tracks = tracksOf(p.tracks);
    return {
      ...p,
      count: tracks.length,
      duration: tracks.reduce((a, t) => a + t.duration, 0),
      plays: tracks.reduce((a, t) => a + t.plays, 0),
      cover: tracks.find((t) => t.cover) || tracks[0] || null
    };
  });
}

export function artistsWithMeta() {
  const out = [];
  for (const entry of S.artists) {
    const tracks = [...S.tracks.values()].filter((t) => t.artist === entry.name);
    const albums = S.albums.filter((a) => a.artist === entry.name);
    out.push({
      name: entry.name,
      plays: entry.plays,
      tracks,
      albums,
      duration: tracks.reduce((a, t) => a + t.duration, 0),
      count: tracks.length,
      cover: tracks.find((t) => t.cover) || tracks[0] || null
    });
  }
  return out.sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name));
}

export function searchAll(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { tracks: [], albums: [], artists: [], playlists: [] };
  const tracks = allTracks().filter((t) => `${t.title} ${t.artist} ${t.album} ${t.genre}`.toLowerCase().includes(q));
  const albums = S.albums.filter((a) => `${a.name} ${a.artist}`.toLowerCase().includes(q));
  const artists = S.artists.filter((a) => a.name.toLowerCase().includes(q));
  const playlists = S.playlists.filter((p) => p.name.toLowerCase().includes(q));
  return { tracks: sortTracks(tracks), albums, artists, playlists };
}

export function historyCounts() {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toDateString();
    days.push({ key, label: d.toLocaleDateString(undefined, { weekday: 'short' }), plays: 0 });
  }
  const index = new Map(days.map((d) => [d.key, d]));
  for (const row of S.history) {
    const day = index.get(new Date(row.at).toDateString());
    if (day) day.plays += 1;
  }
  return days;
}