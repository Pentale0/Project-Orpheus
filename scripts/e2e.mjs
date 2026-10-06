import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4187;
const DEBUG_PORT = 9333;
const BASE = `http://127.0.0.1:${PORT}`;
const SONGS = process.env.ORPHEUS_MUSIC_DIR || path.join(os.homedir(), 'OneDrive', 'Desktop', 'Songs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'orpheus-e2e-'));

const EDGE = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].find((p) => p && fs.existsSync(p));

const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
  env: { ...process.env, PORT: String(PORT), ORPHEUS_DATA_DIR: path.join(TMP, 'data'), ORPHEUS_MUSIC_DIR: SONGS },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', (c) => (serverLog += c));
server.stderr.on('data', (c) => (serverLog += c));

let browser = null;
let socket = null;
let nextId = 0;
const pending = new Map();
const pageErrors = [];

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`CDP timeout: ${method}`));
    }, 20000);
  });
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) throw new Error(`evaluate failed: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`);
  return res.result.value;
}

async function waitFor(expression, label, timeout = 15000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    try {
      last = await evaluate(expression);
      if (last) return last;
    } catch {
      /* page may be mid-navigation */
    }
    await sleep(300);
  }
  ok(label, false, `timed out, last=${JSON.stringify(last)}`);
  return null;
}

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/api/state`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error(`server never started:\n${serverLog}`);
}

async function connect() {
  let targets = null;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      targets = await res.json();
      if (targets.some((t) => t.type === 'page')) break;
    } catch {
      /* browser still starting */
    }
    await sleep(250);
  }
  if (!targets || !targets.some((t) => t.type === 'page')) throw new Error('browser debug port never opened');
  const page = targets.find((t) => t.type === 'page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      pageErrors.push(`${d.text} ${(d.exception && d.exception.description) || ''}`.trim());
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      const entry = msg.params.entry;
      if (!/Failed to load resource|net::ERR/i.test(entry.text) || !/favicon/.test(entry.url || '')) {
        pageErrors.push(`${entry.text} ${(entry.url || '').slice(0, 120)}`);
      }
    }
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Network.enable');
}

try {
  console.log('\nProject Orpheus end-to-end test');
  if (!EDGE) {
    console.log('  skip no browser available');
  } else {
    await waitUp();
    browser = spawn(
      EDGE,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${path.join(TMP, 'profile')}`,
        '--autoplay-policy=no-user-gesture-required',
        '--remote-allow-origins=*',
        BASE
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    let browserLog = '';
    browser.stderr.on('data', (c) => (browserLog += c));
    await connect();

    /* boot */
    await waitFor('document.querySelectorAll(".tr").length > 0', 'library rows render');
    const trackTitle = await evaluate('document.querySelector(".tr .ttl b").textContent');
    ok('first track has a title', Boolean(trackTitle), String(trackTitle));

    /* create a playlist through the modal */
    await evaluate('document.querySelector("#new-pl").click()');
    await waitFor('!!document.querySelector("#modal-pl")', 'playlist modal opens');
    await evaluate('document.querySelector("#modal-pl").value = "Night Drive"');
    await evaluate('document.querySelector(\'form[data-form="create"]\').requestSubmit()');
    await waitFor('document.querySelectorAll(".pl-row").length === 1', 'playlist appears in sidebar');
    const createdName = await evaluate('document.querySelector(".pl-row .pl-name").textContent');
    ok('created playlist name shows', createdName === 'Night Drive', String(createdName));

    /* add first track through the + modal */
    await evaluate(`document.querySelector('[data-nav="library"]').click()`);
    await waitFor('!!document.querySelector(\'.tr [data-act="add"]\')', 'library rows available again');
    await evaluate(`document.querySelector('.tr [data-act="add"]').click()`);
    await waitFor('!!document.querySelector(".pick")', 'add-to-playlist modal opens');
    await evaluate('document.querySelector(".pick").click()');
    await waitFor('document.querySelector(".pick")?.classList.contains("is-in")', 'track marked as added');
    await evaluate('document.querySelector(\'[data-act="close-modal"]\').click()');
    await waitFor('!document.querySelector(".scrim")', 'modal closes');

    /* open the playlist */
    await evaluate('document.querySelector(".pl-row").click()');
    await waitFor('document.querySelector(".top-title")?.textContent === "Night Drive"', 'playlist view opens');
    await waitFor('document.querySelectorAll(".tr").length === 1', 'playlist holds one track');
    ok('playlist hero shows one track', /1 track/.test((await evaluate('document.querySelector(".top-meta").textContent')) || ''));

    /* play it and let the counter tick over */
    await evaluate('document.querySelector(".tr .pbtn, .tr .ttl").click()');
    await waitFor('!document.querySelector("#np-title").textContent.includes("Nothing playing")', 'now-playing updates');
    await waitFor('document.documentElement.classList.contains("is-playing")', 'audio is playing');
    const paused = await evaluate('document.querySelector("#b-play").getAttribute("aria-label")');
    ok('play button flips to pause', paused === 'Pause', String(paused));

    const counted = await waitFor(
      '(async () => { const t = await (await fetch("/api/state")).json(); return t.tracks.some(x => x.plays >= 1); })()',
      'play count reaches 1 after listening',
      45000
    );
    if (counted) {
      const state = await (await fetch(`${BASE}/api/state`)).json();
      const row = state.tracks.find((t) => t.plays > 0);
      ok('play count persisted to server', row && row.plays >= 1, `plays=${row && row.plays}`);
      ok('listening time recorded', state.tracks.some((t) => t.listenSec > 0));
      const wallet = await evaluate('document.querySelector(".top-meta").textContent');
      ok('hero total plays updated', /\d+\s*plays/.test(wallet || ''), String(wallet));
    }

    /* like it, check the Liked view */
    await evaluate('document.querySelector("#b-like").click()');
    await waitFor(
      '(async () => { const t = await (await fetch("/api/state")).json(); return t.tracks.some(x => x.liked); })()',
      'like reaches the server'
    );
    await evaluate('document.querySelector(\'[data-nav="liked"]\').click()');
    await waitFor('document.querySelector(".top-title")?.textContent === "Liked Songs"', 'liked view opens');
    ok('liked view lists the track', (await evaluate('document.querySelectorAll(".tr").length')) === 1);

    /* stats view reflects the play */
    await evaluate('document.querySelector(\'[data-nav="stats"]\').click()');
    await waitFor('!!document.querySelector(".kpi")', 'stats view opens');
    const kpis = (await evaluate('[...document.querySelectorAll(".kpi small")].map(n => n.textContent)')) || [];
    ok('stats shows plays and listen time', kpis.some((k) => /Total plays/.test(k)) && kpis.some((k) => /Time listened/.test(k)), kpis.join(' | '));

    /* queue drawer */
    await evaluate('document.querySelector(\'[data-act="queue"]\').click()');
    await waitFor('!document.querySelector("#queue").hidden', 'queue drawer opens');
    ok('queue shows the playing track', (await evaluate('document.querySelectorAll(".q-item").length')) >= 1);

    const realErrors = pageErrors.filter((e) => !/favicon/i.test(e));
    ok('no page errors during the run', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
    if (browserLog) fs.writeFileSync(path.join(TMP, 'browser.log'), browserLog);
  }
} catch (err) {
  failures.push(err.message);
  console.error('e2e crashed:', err);
} finally {
  if (socket) try { socket.close(); } catch { /* ignore */ }
  if (browser) browser.kill();
  server.kill();
  if (failures.length) {
    console.log(`\n${failures.length} failed`);
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  } else {
    console.log('\nall good');
  }
  setTimeout(() => fs.rmSync(TMP, { recursive: true, force: true }), 500);
}