import { api } from './api.js';
import { S, ingest } from './state.js';
import { renderAll, renderSidebar, renderTop, renderView } from './views.js';
import { toast } from './util.js';

function upsert(list) {
  const index = S.playlists.findIndex((p) => p.id === list.id);
  if (index >= 0) S.playlists[index] = { ...S.playlists[index], ...list };
  else S.playlists.push(list);
}

export async function createPlaylist(name) {
  const clean = String(name || '').trim();
  if (!clean) {
    toast('Give the playlist a name first.');
    return null;
  }
  try {
    const list = await api.createPlaylist(clean);
    upsert(list);
    renderSidebar();
    toast(`Created ${list.name}`);
    return list;
  } catch (err) {
    toast(`Could not create playlist: ${err.message}`);
    return null;
  }
}

export async function renamePlaylist(id, name) {
  const clean = String(name || '').trim();
  if (!clean) return;
  try {
    upsert(await api.updatePlaylist(id, { name: clean }));
    renderSidebar();
    renderTop();
    toast('Playlist renamed.');
  } catch (err) {
    toast(`Rename failed: ${err.message}`);
  }
}

export async function deletePlaylist(id) {
  const list = S.playlists.find((p) => p.id === id);
  try {
    await api.deletePlaylist(id);
    S.playlists = S.playlists.filter((p) => p.id !== id);
    renderSidebar();
    toast(`Deleted ${list ? list.name : 'playlist'}`);
    return true;
  } catch (err) {
    toast(`Delete failed: ${err.message}`);
    return false;
  }
}

export async function toggleInPlaylist(playlistId, trackId) {
  const list = S.playlists.find((p) => p.id === playlistId);
  if (!list) return;
  const index = list.tracks.indexOf(trackId);
  const next = list.tracks.slice();
  if (index >= 0) next.splice(index, 1);
  else next.push(trackId);
  try {
    upsert(await api.updatePlaylist(playlistId, { tracks: next }));
    renderSidebar();
    toast(index >= 0 ? `Removed from ${list.name}` : `Added to ${list.name}`);
  } catch (err) {
    toast(`Update failed: ${err.message}`);
  }
}

export async function addToPlaylist(playlistId, trackId) {
  const list = S.playlists.find((p) => p.id === playlistId);
  if (!list || list.tracks.includes(trackId)) return;
  try {
    upsert(await api.updatePlaylist(playlistId, { tracks: [...list.tracks, trackId] }));
    renderSidebar();
    toast(`Added to ${list.name}`);
  } catch (err) {
    toast(`Update failed: ${err.message}`);
  }
}

export async function removeFromPlaylist(playlistId, trackId) {
  const list = S.playlists.find((p) => p.id === playlistId);
  if (!list) return;
  try {
    upsert(await api.updatePlaylist(playlistId, { tracks: list.tracks.filter((id) => id !== trackId) }));
    renderSidebar();
    toast(`Removed from ${list.name}`);
  } catch (err) {
    toast(`Update failed: ${err.message}`);
  }
}

export async function moveInPlaylist(playlistId, trackId, delta) {
  const list = S.playlists.find((p) => p.id === playlistId);
  if (!list) return null;
  const from = list.tracks.indexOf(trackId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.tracks.length) return null;
  const next = list.tracks.slice();
  [next[from], next[to]] = [next[to], next[from]];
  try {
    upsert(await api.updatePlaylist(playlistId, { tracks: next }));
    return to;
  } catch (err) {
    toast(`Reorder failed: ${err.message}`);
    return null;
  }
}

export async function toggleLike(trackId) {
  try {
    const res = await api.like(trackId);
    const track = S.tracks.get(trackId);
    if (track) track.liked = res.liked;
    renderView(false);
    renderTop();
    return res.liked;
  } catch (err) {
    toast(`Could not save: ${err.message}`);
    return null;
  }
}

export async function resetStats() {
  try {
    ingest(await api.resetStats());
    renderAll(true);
    toast('Play counts cleared.');
  } catch (err) {
    toast(`Reset failed: ${err.message}`);
  }
}

export async function refreshState() {
  ingest(await api.state());
  renderAll(false);
}