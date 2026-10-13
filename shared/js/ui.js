export function el(id) {
  return document.getElementById(id);
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function setActiveView(name) {
  qsa('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === name));
}

export function trapFocus(container) {
  const focusable = qsa(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea',
    container
  );
  if (focusable.length === 0) return { release: () => {} };
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  function onKey(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  container.addEventListener('keydown', onKey);
  first.focus();
  return { release: () => container.removeEventListener('keydown', onKey) };
}
