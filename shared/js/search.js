export function filterSongs(songs, query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return songs;
  return songs.filter((s) => {
    return (
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.album.toLowerCase().includes(q)
    );
  });
}
