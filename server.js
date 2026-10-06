import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Library } from './lib/library.js';
import { Store } from './lib/store.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DATA = process.env.ORPHEUS_DATA_DIR || path.join(ROOT, 'data');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon'
};

const store = new Store(path.join(DATA, 'state.json'));
const library = new Library(store, null, ROOT);

function sendJSON(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 512) {
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const target = path.normalize(path.join(PUBLIC, rel));
  if (!target.startsWith(PUBLIC)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  let stat;
  try {
    stat = await fsp.stat(target);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  if (stat.isDirectory()) {
    res.writeHead(302, { Location: `${pathname.replace(/\/$/, '')}/index.html` }).end();
    return;
  }
  const type = STATIC_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream';
  const etag = `W/"${stat.size}-${Math.round(stat.mtimeMs)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag }).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    ETag: etag,
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(target).pipe(res);
}

async function serveAudio(req, res, id) {
  const track = library.get(id);
  if (!track) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Track not found');
    return;
  }
  let stat;
  try {
    stat = await fsp.stat(track.file);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('File missing on disk');
    return;
  }
  const range = req.headers.range;
  const headers = {
    'Content-Type': track.mime || 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
    'Content-Disposition': `inline; filename="${encodeURIComponent(path.basename(track.file))}"`
  };
  if (!range) {
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(track.file).pipe(res);
    return;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) {
    res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` }).end();
    return;
  }
  let start = match[1] === '' ? 0 : Number(match[1]);
  let end = match[2] === '' ? stat.size - 1 : Number(match[2]);
  if (match[1] === '') {
    start = Math.max(0, stat.size - end);
    end = stat.size - 1;
  }
  if (start > end || start >= stat.size) {
    res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` }).end();
    return;
  }
  end = Math.min(end, stat.size - 1);
  res.writeHead(206, {
    ...headers,
    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
    'Content-Length': end - start + 1
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(track.file, { start, end }).pipe(res);
}

async function serveCover(req, res, id) {
  const track = library.get(id);
  if (!track) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Track not found');
    return;
  }
  const pic = await library.cover(id);
  if (!pic) {
    res.writeHead(302, { Location: '/img/cover-fallback.svg' }).end();
    return;
  }
  const etag = `W/"cover-${track.size}-${pic.data.length}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag }).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': pic.mime,
    'Content-Length': pic.data.length,
    ETag: etag,
    'Cache-Control': 'public, max-age=86400'
  });
  res.end(pic.data);
}

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method;

  if (pathname === '/api/state' && method === 'GET') return sendJSON(res, 200, library.snapshot());
  if (pathname === '/api/rescan' && method === 'POST') {
    const count = await library.refresh();
    return sendJSON(res, 200, { tracks: count, snapshot: library.snapshot() });
  }

  if (pathname === '/api/play' && method === 'POST') {
    const body = await readBody(req);
    const track = library.get(body.id);
    if (!track) return sendJSON(res, 404, { error: 'unknown track' });
    const at = Number(body.at) || Date.now();
    const stats = store.recordPlay(body.id, at);
    library.syncStats(track);
    return sendJSON(res, 200, { id: track.id, plays: stats.plays, plays_total: library.snapshot().totals.plays });
  }

  if (pathname === '/api/listen' && method === 'POST') {
    const body = await readBody(req);
    const track = library.get(body.id);
    if (!track) return sendJSON(res, 404, { error: 'unknown track' });
    const stats = store.recordListen(body.id, Number(body.sec) || 0, Number(body.at) || Date.now());
    library.syncStats(track);
    return sendJSON(res, 200, { id: track.id, listenSec: stats.listenSec });
  }

  if (pathname === '/api/duration' && method === 'POST') {
    const body = await readBody(req);
    const track = library.get(body.id);
    if (!track) return sendJSON(res, 404, { error: 'unknown track' });
    store.setDuration(body.id, Number(body.duration));
    track.duration = Math.round(Number(body.duration));
    return sendJSON(res, 200, { id: track.id, duration: track.duration });
  }

  if (pathname === '/api/like' && method === 'POST') {
    const body = await readBody(req);
    const track = library.get(body.id);
    if (!track) return sendJSON(res, 404, { error: 'unknown track' });
    const liked = store.toggleLiked(body.id);
    track.liked = liked;
    return sendJSON(res, 200, { id: track.id, liked });
  }

  const trackMatch = /^\/api\/track\/([\w-]+)$/.exec(pathname);
  if (trackMatch && (method === 'PATCH' || method === 'PUT')) {
    const body = await readBody(req);
    const updated = await library.updateTrack(trackMatch[1], body);
    return updated ? sendJSON(res, 200, updated) : sendJSON(res, 404, { error: 'unknown track' });
  }

  if (pathname === '/api/playlists' && method === 'POST') {
    const body = await readBody(req);
    return sendJSON(res, 200, store.createPlaylist(body.name));
  }

  const plMatch = /^\/api\/playlists\/([\w-]+)$/.exec(pathname);
  if (plMatch) {
    const id = plMatch[1];
    if (method === 'PATCH' || method === 'PUT') {
      const body = await readBody(req);
      const updated = store.updatePlaylist(id, body);
      return updated ? sendJSON(res, 200, updated) : sendJSON(res, 404, { error: 'unknown playlist' });
    }
    if (method === 'DELETE') {
      store.deletePlaylist(id);
      return sendJSON(res, 200, { id });
    }
  }

  if (pathname === '/api/stats/reset' && method === 'POST') {
    store.resetStats();
    for (const track of library.all()) library.syncStats(track);
    return sendJSON(res, 200, library.snapshot());
  }

  const audioMatch = /^\/api\/audio\/([\w-]+)$/.exec(pathname);
  if (audioMatch && (method === 'GET' || method === 'HEAD')) return serveAudio(req, res, audioMatch[1]);

  const coverMatch = /^\/api\/cover\/([\w-]+)$/.exec(pathname);
  if (coverMatch && (method === 'GET' || method === 'HEAD')) return serveCover(req, res, coverMatch[1]);

  return sendJSON(res, 404, { error: 'unknown endpoint' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end('Method not allowed');
      return;
    }
    return await serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) sendJSON(res, 500, { error: err.message });
    else res.end();
  }
});

async function boot() {
  await store.load();
  const count = await library.refresh().catch((err) => {
    console.warn('[library] scan failed:', err.message);
    return 0;
  });
  server.listen(PORT, HOST, async () => {
    const url = `http://${HOST}:${PORT}`;
    console.log('');
    console.log('  ORPHEUS  ·  local music server');
    console.log(`  ${url}`);
    console.log('');
    console.log(`  ${count} track${count === 1 ? '' : 's'} loaded from:`);
    for (const dir of library.folders) console.log(`    ${dir}`);
    if (!library.folders.length) console.log('    (no music folder found - set ORPHEUS_MUSIC_DIR)');
    console.log('');
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log('\n[server] saving state, bye');
    await store.save().catch(() => {});
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}

boot();