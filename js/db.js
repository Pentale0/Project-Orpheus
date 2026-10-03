const DB_NAME = 'orpheus-db';
const DB_VERSION = 1;

let db;

async function initDB() {
  if (db) return db;
  db = await idb.openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('songs')) {
        const store = db.createObjectStore('songs', { keyPath: 'id' });
        store.createIndex('album', 'album');
        store.createIndex('artist', 'artist');
        store.createIndex('addedAt', 'addedAt');
      }
      if (!db.objectStoreNames.contains('playlists')) {
        const store = db.createObjectStore('playlists', { keyPath: 'id' });
        store.createIndex('name', 'name');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    }
  });
  return db;
}

async function addSong(song) {
  const db = await initDB();
  await db.add('songs', song);
  return song;
}

async function getAllSongs() {
  const db = await initDB();
  return await db.getAll('songs');
}

async function deleteSong(id) {
  const db = await initDB();
  await db.delete('songs', id);
}

async function getAllPlaylists() {
  const db = await initDB();
  return await db.getAll('playlists');
}

async function addPlaylist(playlist) {
  const db = await initDB();
  await db.add('playlists', playlist);
  return playlist;
}

async function updatePlaylist(playlist) {
  const db = await initDB();
  await db.put('playlists', playlist);
}

async function deletePlaylist(id) {
  const db = await initDB();
  await db.delete('playlists', id);
}

async function getSetting(key) {
  const db = await initDB();
  const res = await db.get('settings', key);
  return res ? res.value : null;
}

async function setSetting(key, value) {
  const db = await initDB();
  await db.put('settings', { key, value });
}
