export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmt(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function fmtLong(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} hr ${String(m).padStart(2, '0')} min`;
  if (m) return `${m} min`;
  return `${s} sec`;
}

export function fmtCount(n) {
  return (n || 0).toLocaleString();
}

export function ago(ts) {
  if (!ts) return 'never';
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)} min ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)} h ago`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)} d ago`;
  if (d < 365) return `${Math.floor(d / 7)} w ago`;
  return new Date(ts).toLocaleDateString();
}

export function day(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function hash(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export const ls = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode */
    }
  }
};

function svg(body, filled) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" ${
    filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"'
  }>${body}</svg>`;
}

export const ICON = {
  play: svg('<polygon points="6 4 20 12 6 20"/>', true),
  pause: svg('<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>', true),
  prev: svg('<polygon points="19 20 9 12 19 4"/><rect x="5" y="4" width="3" height="16"/>', true),
  next: svg('<polygon points="5 4 15 12 5 20"/><rect x="16" y="4" width="3" height="16"/>', true),
  shuffle: svg('<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>'),
  repeat: svg('<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
  plus: svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
  x: svg('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>'),
  up: svg('<polyline points="6 15 12 9 18 15"/>'),
  down: svg('<polyline points="6 9 12 15 18 9"/>'),
  gem: svg('<polygon points="12 2 21 9 12 22 3 9"/>', true),
  disc: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 7a4 4 0 0 1 7 3.7C19 15.6 12 20 12 20z"/>'),
  queue: svg('<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/>'),
  vol: svg('<polygon points="4 10 8 10 13 5 13 19 8 14 4 14"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>'),
  mute: svg('<polygon points="4 10 8 10 13 5 13 19 8 14 4 14"/><line x1="16" y1="9" x2="21" y2="15"/><line x1="21" y1="9" x2="16" y2="15"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>'),
  home: svg('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>'),
  edit: svg('<path d="M4 20h4L20 8l-4-4L4 16z"/>'),
  trash: svg('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>'),
  chart: svg('<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="11" width="3.5" height="6"/><rect x="11" y="7" width="3.5" height="10"/><rect x="16" y="13" width="3.5" height="4"/>'),
  refresh: svg('<polyline points="20 6 20 12 14 12"/><path d="M20 12a8 8 0 1 0-2.3 5.7"/>')
};

export function fillIcons(root = document) {
  $$('[data-ic]', root).forEach((node) => {
    const icon = ICON[node.dataset.ic];
    if (icon) node.innerHTML = icon;
  });
}

export function artHTML(track, size) {
  const cls = size === 'big' ? 'art big' : 'art';
  if (track && track.cover) {
    return `<span class="${cls}"><img src="/api/cover/${encodeURIComponent(track.id)}" alt="" loading="lazy"></span>`;
  }
  const h = hash(track ? track.id : 'orpheus');
  const angle = ((h >> 8) % 180) + 90;
  return `<span class="${cls} rnd" style="--h:${200 + (h % 50)};--a:${angle}deg"></span>`;
}

let toastTimer = null;
export function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2400);
}

export function bindBar(hit, onValue) {
  let dragging = false;
  const valueAt = (event) => {
    const rect = hit.getBoundingClientRect();
    return clamp((event.clientX - rect.left) / rect.width, 0, 1);
  };
  hit.addEventListener('pointerdown', (event) => {
    dragging = true;
    try {
      hit.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    onValue(valueAt(event));
  });
  hit.addEventListener('pointermove', (event) => {
    if (dragging) onValue(valueAt(event));
  });
  hit.addEventListener('pointerup', (event) => {
    if (!dragging) return;
    dragging = false;
    onValue(valueAt(event));
  });
  hit.addEventListener('pointercancel', () => {
    dragging = false;
  });
}

export function shuffleList(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}