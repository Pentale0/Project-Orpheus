import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4199;
const BASE = `http://127.0.0.1:${PORT}`;
const SONGS = process.env.ORPHEUS_MUSIC_DIR || path.join(os.homedir(), 'OneDrive', 'Desktop', 'Songs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'orpheus-test-'));

let passed = 0;
const failures = [];
const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
  env: { ...process.env, PORT: String(PORT), ORPHEUS_DATA_DIR: TMP, ORPHEUS_MUSIC_DIR: SONGS },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', (chunk) => {
  serverLog += chunk;
});
server.stderr.on('data', (chunk) => {
  serverLog += chunk;
});

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/api/state`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server never came up:\n${serverLog}`);
}

async function post(url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

try {
  await waitForServer();
  console.log('\nProject Orpheus check');

  const stateRes = await fetch(`${BASE}/api/state`);
  check('GET /api/state returns 200', stateRes.status === 200);
  const state = await stateRes.json();
  check('library has tracks', state.tracks.length > 0, `found ${state.tracks.length}`);
  check('tracks expose play counters', state.tracks.every((t) => typeof t.plays === 'number'));
  check('tracks expose duration', state.tracks.some((t) => t.duration > 0), 'no parsed durations');
  check('tracks have url endpoints', state.tracks.every((t) => t.url.startsWith('/api/audio/')));
  check('artists grouped', state.artists.length > 0, 'no artists');
  check('albums grouped', state.albums.length > 0, 'no albums');

  const first = state.tracks[0];
  const withCover = state.tracks.find((t) => t.cover);
  if (!withCover) console.log('  note no tag-based cover art found in this folder');

  const head = await fetch(`${BASE}${first.url}`, { headers: { Range: 'bytes=0-1023' } });
  check('audio range request returns 206', head.status === 206, `status ${head.status}`);
  check('audio range header is set', String(head.headers.get('content-range') || '').startsWith('bytes 0-1023/'));
  const chunk = Buffer.from(await head.arrayBuffer());
  check('audio range payload length', chunk.length === 1024, `got ${chunk.length}`);
  check('audio is mpeg', head.headers.get('content-type') === 'audio/mpeg', head.headers.get('content-type'));

  const full = await fetch(`${BASE}${first.url}`);
  check('full audio request returns 200', full.status === 200);
  check('full audio length matches size', Number(full.headers.get('content-length')) === first.size, 'length mismatch');
  await full.arrayBuffer();

  if (withCover) {
    const cover = await fetch(`${BASE}/api/cover/${withCover.id}`);
    check('cover art returns image', (cover.headers.get('content-type') || '').startsWith('image/'), cover.headers.get('content-type'));
    await cover.arrayBuffer();
  }

  const created = await post('/api/playlists', { name: 'Test drive' });
  check('create playlist', created.status === 200 && created.body.name === 'Test drive');
  const playlistId = created.body.id;

  const updated = await fetch(`${BASE}/api/playlists/${playlistId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Night drive', tracks: [first.id] })
  });
  const updatedBody = await updated.json();
  check('update playlist name and tracks', updated.status === 200 && updatedBody.name === 'Night drive' && updatedBody.tracks.length === 1);

  const afterPlay = await post('/api/play', { id: first.id });
  check('record a play', afterPlay.status === 200 && afterPlay.body.plays === 1, JSON.stringify(afterPlay.body));

  const afterListen = await post('/api/listen', { id: first.id, sec: 42 });
  check('record listening time', afterListen.status === 200 && afterListen.body.listenSec === 42, JSON.stringify(afterListen.body));

  const durationRes = await post('/api/duration', { id: first.id, duration: 222.4 });
  check('store measured duration', durationRes.status === 200 && durationRes.body.duration === 222);

  const likeRes = await post('/api/like', { id: first.id });
  check('toggle like', likeRes.status === 200 && likeRes.body.liked === true);

  const state2 = await (await fetch(`${BASE}/api/state`)).json();
  const statsRow = state2.tracks.find((t) => t.id === first.id);
  check('play count visible in state', statsRow.plays === 1, `plays=${statsRow.plays}`);
  check('listen time visible in state', statsRow.listenSec === 42, `listenSec=${statsRow.listenSec}`);
  check('like visible in state', statsRow.liked === true);
  check('playlist visible in state', state2.playlists.some((p) => p.name === 'Night drive'));
  check('total plays updated', state2.totals.plays >= 1);

  let persisted = null;
  for (let i = 0; i < 20 && !persisted; i++) {
    try {
      persisted = JSON.parse(fs.readFileSync(path.join(TMP, 'state.json'), 'utf8'));
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  check('state written to disk', persisted && persisted.stats[first.id] && persisted.stats[first.id].plays === 1);

  const index = await fetch(`${BASE}/`);
  check('serves index.html', index.status === 200 && (index.headers.get('content-type') || '').includes('text/html'));
  await index.text();

  const traversal = await fetch(`${BASE}/../server.js`);
  check('blocks path traversal', traversal.status === 404 || traversal.status === 403, `status ${traversal.status}`);

  const missing = await fetch(`${BASE}/api/audio/deadbeefdeadbeef`);
  check('unknown track returns 404', missing.status === 404);

  const deleted = await fetch(`${BASE}/api/playlists/${playlistId}`, { method: 'DELETE' });
  check('delete playlist', deleted.status === 200);
  const state3 = await (await fetch(`${BASE}/api/state`)).json();
  check('playlist gone from state', !state3.playlists.some((p) => p.id === playlistId));

  const rescan = await post('/api/rescan');
  check('rescan works', rescan.status === 200 && rescan.body.tracks > 0);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) console.log(failures.map((f) => `  - ${f}`).join('\n'));
} catch (err) {
  console.error('check crashed:', err);
  failures.push(err.message);
} finally {
  server.kill();
  fs.rmSync(TMP, { recursive: true, force: true });
  if (failures.length) process.exitCode = 1;
}