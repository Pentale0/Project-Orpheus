# Project Orpheus

A local Spotify-style music player. Point it at a folder of songs, make your own
playlists, and it counts how many times you have heard each track.

- Zero dependencies - just Node 18+ and a browser
- Streams your own files over HTTP (seekable, range requests)
- Play counts, listening time and history are counted by the server and survive reloads
- Playlists, likes and tag edits are stored on disk

## Run it

```bash
npm start
```

Then open <http://127.0.0.1:4173>.

Windows: double-click `Start Orpheus.bat` instead.

### Where it looks for music

1. `ORPHEUS_MUSIC_DIR` environment variable, if set (several folders with `;`)
2. `./music`
3. `~/OneDrive/Desktop/Songs`, `~/Desktop/Songs`, `~/Music`

```bash
set ORPHEUS_MUSIC_DIR=C:\path\to\your\songs
npm start
```

Press **Rescan folder** in the app after you add files.

## Using it

| Do this | How |
| --- | --- |
| Play a track | Click a row, or the `#` play button, or press `Enter` on the selection |
| Create a playlist | `+` next to the Playlists heading in the sidebar |
| Add a track to a playlist | `+` on any track row, then pick the playlist |
| Reorder a playlist | `↑` / `↓` on a row inside the playlist |
| Like a track | The heart on a row or in the player bar, then open **Liked** |
| Fix a wrong title/artist/album | The pencil on a track row (saved to `metadata.json`) |
| See play counts | The **Plays** column, or the **Listening** section |
| Keyboard | `Space` play/pause, `↑ ↓` select, `Enter` play, `Q`/`E` switch section, `/` search, `Esc` back, `Shift+←/→` prev/next |

A play counts after 30 seconds of listening (or half of a short track), and
listening time keeps accumulating while the song plays.

## How it works

```
server.js          HTTP server: static files + /api/*
lib/id3.js         ID3v2 tag parsing, MP3 duration from frame headers
lib/library.js     scans the music folder, merges metadata + play stats
lib/store.js       data/state.json: playlists, play counts, likes, history
public/            the app (index.html, css, js modules)
metadata.json      optional tag overrides (artist/album/title), committed
data/              runtime state, git-ignored
```

### API

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/state` | tracks, playlists, albums, totals, history |
| GET | `/api/audio/:id` | streams the file, supports `Range` |
| GET | `/api/cover/:id` | embedded cover art, if the file has any |
| POST | `/api/play` | count a play |
| POST | `/api/listen` | add listening seconds |
| POST | `/api/like` | toggle like |
| POST | `/api/playlists` | create |
| PATCH | `/api/playlists/:id` | rename / set tracks |
| DELETE | `/api/playlists/:id` | delete |
| PATCH | `/api/track/:id` | edit title/artist/album |
| POST | `/api/rescan` | rescan the music folder |
| POST | `/api/stats/reset` | clear play counts |

## Tests

```bash
npm test      # server + API checks against your music folder
npm run smoke # headless browser: views render, no console errors
npm run e2e   # headless browser: playlist -> play -> count -> stats
```

The browser tests use Edge or Chrome if installed and skip otherwise.

## Notes

- The server binds to `127.0.0.1` only; nothing is exposed to the network.
- Audio files are never copied or modified. Nothing leaves your machine.
- Override the port with `PORT=8080 npm start`.
