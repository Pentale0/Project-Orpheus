import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4188;
const BASE = `http://127.0.0.1:${PORT}`;
const SONGS = process.env.ORPHEUS_MUSIC_DIR || path.join(os.homedir(), 'OneDrive', 'Desktop', 'Songs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'orpheus-smoke-'));
const OUT = path.join(TMP, 'out');
fs.mkdirSync(OUT, { recursive: true });

const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean);

const edge = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`);
  }
};

const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
  env: { ...process.env, PORT: String(PORT), ORPHEUS_DATA_DIR: path.join(TMP, 'data'), ORPHEUS_MUSIC_DIR: SONGS },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', (c) => (serverLog += c));
server.stderr.on('data', (c) => (serverLog += c));

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/api/state`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server never started:\n${serverLog}`);
}

function dump(url, name, extra = []) {
  return new Promise((resolve) => {
    const profile = path.join(TMP, `profile-${name}`);
    const proc = spawn(
      edge,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--autoplay-policy=no-user-gesture-required',
        `--user-data-dir=${profile}`,
        '--enable-logging=stderr',
        '--v=0',
        '--virtual-time-budget=9000',
        ...extra,
        '--dump-dom',
        url
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let dom = '';
    let logs = '';
    proc.stdout.on('data', (c) => (dom += c));
    proc.stderr.on('data', (c) => (logs += c));
    const timer = setTimeout(() => proc.kill(), 45000);
    proc.on('close', () => {
      clearTimeout(timer);
      fs.writeFileSync(path.join(OUT, `${name}.html`), dom);
      fs.writeFileSync(path.join(OUT, `${name}.log`), logs);
      resolve({ dom, logs });
    });
  });
}

const consoleErrors = (logs) =>
  logs
    .split(/\r?\n/)
    .filter((line) => /CONSOLE|Uncaught|SyntaxError|TypeError|ReferenceError/.test(line))
    .filter((line) => !/chrome-extension:|Fontconfig|dbus|GPU|vulkan|ozone|ProtocolLaunch/i.test(line));

try {
  console.log('\nProject Orpheus UI smoke test');
  await waitUp();
  if (!edge) {
    console.log('  skip no headless browser found (Edge/Chrome)');
  } else {
    const home = await dump(`${BASE}/`, 'home');
    ok('home page renders app shell', /class="brand"/.test(home.dom) && /ORPHEUS/.test(home.dom));
    ok('track rows rendered', /class="tbl/.test(home.dom) && /class="tr[^"]*"/.test(home.dom), `${(home.dom.match(/class="tr[ "]/g) || []).length} rows`);
    ok('playlists section rendered', /Playlists<\/span>|No playlists yet/.test(home.dom));
    ok('player bar rendered', /id="np-title"/.test(home.dom));
    const rowCount = (home.dom.match(/class="tr[^"]*"/g) || []).length;
    ok('home shows library rows', rowCount >= 10, `${rowCount} rows`);
    ok('metadata artist visible', /Michael Jackson/.test(home.dom));
    const homeErrors = consoleErrors(home.logs);
    ok('no console errors on home', homeErrors.length === 0, homeErrors.slice(0, 4).join(' | '));

    const library = await dump(`${BASE}/#/library`, 'library');
    const libErrors = consoleErrors(library.logs);
    ok('library view renders rows', (library.dom.match(/class="tr[^"]*"/g) || []).length >= 10);
    ok('search field present', /id="q"/.test(library.dom));
    ok('no console errors on library', libErrors.length === 0, libErrors.slice(0, 4).join(' | '));

    const stats = await dump(`${BASE}/#/stats`, 'stats');
    const statsErrors = consoleErrors(stats.logs);
    ok('stats view renders KPIs', /Total plays/.test(stats.dom));
    ok('no console errors on stats', statsErrors.length === 0, statsErrors.slice(0, 4).join(' | '));
  }
} catch (err) {
  failures.push(err.message);
  console.error('smoke crashed:', err);
} finally {
  server.kill();
  setTimeout(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    console.log(`\n${failures.length ? `${failures.length} failed` : 'all good'}`);
    if (failures.length) process.exitCode = 1;
  }, 400);
}