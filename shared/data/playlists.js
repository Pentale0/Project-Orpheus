export let PLAYLISTS = [
  {
    id: 'p001',
    name: 'Favorites',
    songIds: [],
  },
];

export function createPlaylist(name, songIds = []) {
  const id = 'p' + Date.now().toString().slice(-6);
  const pl = { id, name, songIds: [...songIds] };
  PLAYLISTS.push(pl);
  return pl;
}

export function addSongToPlaylist(playlistId, songId) {
  const pl = PLAYLISTS.find((p) => p.id === playlistId);
  if (!pl) return null;
  if (!pl.songIds.includes(songId)) pl.songIds.push(songId);
  return pl;
}

export function removeSongFromPlaylist(playlistId, songId) {
  const pl = PLAYLISTS.find((p) => p.id === playlistId);
  if (!pl) return null;
  pl.songIds = pl.songIds.filter((id) => id !== songId);
  return pl;
}

export function renamePlaylist(playlistId, newName) {
  const pl = PLAYLISTS.find((p) => p.id === playlistId);
  if (!pl) return null;
  pl.name = newName.trim();
  return pl;
}

export function deletePlaylist(playlistId) {
  const idx = PLAYLISTS.findIndex((p) => p.id === playlistId);
  if (idx === -1) return false;
  PLAYLISTS.splice(idx, 1);
  return true;
}
