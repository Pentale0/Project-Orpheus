async function importFiles(files) {
  const results = [];
  for (const file of files) {
    if (file.type !== 'audio/mpeg' && file.type !== 'audio/mp3' && !file.name.endsWith('.mp3')) {
      continue;
    }
    const song = await readSongMetadata(file);
    results.push(song);
  }
  for (const song of results) {
    await window.db.addSong(song);
  }
  return results;
}

function readSongMetadata(file) {
  return new Promise((resolve, reject) => {
    const jsmediatags = window.jsmediatags;
    jsmediatags.read(file, {
      onSuccess: function (tag) {
        const tags = tag.tags;
        const picture = tags.picture;
        let coverBlob = null;
        if (picture) {
          const byteArray = new Uint8Array(picture.data);
          coverBlob = new Blob([byteArray], { type: picture.format });
        }
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        audio.onloadedmetadata = () => {
          URL.revokeObjectURL(audio.src);
          resolve({
            id: generateId(),
            title: tags.title || file.name.replace(/\.mp3$/i, ''),
            artist: tags.artist || 'Unknown',
            album: tags.album || 'Unknown',
            duration: audio.duration || 0,
            coverBlob: coverBlob,
            fileBlob: file,
            addedAt: Date.now()
          });
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audio.src);
          resolve({
            id: generateId(),
            title: file.name.replace(/\.mp3$/i, ''),
            artist: 'Unknown',
            album: 'Unknown',
            duration: 0,
            coverBlob: null,
            fileBlob: file,
            addedAt: Date.now()
          });
        };
      },
      onError: function (error) {
        resolve({
          id: generateId(),
          title: file.name.replace(/\.mp3$/i, ''),
          artist: 'Unknown',
          album: 'Unknown',
          duration: 0,
          coverBlob: null,
          fileBlob: file,
          addedAt: Date.now()
        });
      }
    });
  });
}
