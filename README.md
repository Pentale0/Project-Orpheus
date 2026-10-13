# Orpheus Player

A local-only music player styled after Persona 3 Reload and Persona 5 Royal. No DB, hardcoded songs. Playlists in localStorage. Web + Desktop (Electron).

## Quick start (Web)

1. Open `shared/index.html` in a browser (Chrome/Edge recommended).
2. Or serve `shared/` with a local server: `python -m http.server 8000` then open http://localhost:8000/shared/

## Quick start (Desktop)

1. Install deps: `cd desktop && npm install electron --save-dev` (or globally available)
2. Run: `npm start`

## Features

- Both themes (P3R/P5R) with toggle
- Hardcoded songs from local files
- Make playlists, add/remove songs
- Play/pause/next/prev/seek
- Search by title/artist/album
- Keyboard-navigable
- Responsive
- Hover/active/selected states
- Stats/Profile screen with calendar
- Popup dialog (2 choices)
- Now playing bar

## Structure

- `shared/` - core app (HTML/CSS/JS/data/media)
- `web/` - web wrapper
- `desktop/` - Electron wrapper
