export const Theme = {
  init() {
    const saved = localStorage.getItem('orpheus:theme') || 'p3r';
    this.set(saved);
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.addEventListener('click', () => this.toggle());
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggle();
        }
      });
    }
  },
  set(theme) {
    const t = theme === 'p5r' ? 'p5r' : 'p3r';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('orpheus:theme', t); } catch (e) {}
    const p5css = document.getElementById('themeCssP5r');
    if (p5css) p5css.disabled = t !== 'p5r';
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.textContent = t === 'p5r' ? 'Theme: P5R' : 'Theme: P3R';
      btn.setAttribute('aria-pressed', t === 'p5r' ? 'true' : 'false');
    }
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'p3r';
    this.set(current === 'p3r' ? 'p5r' : 'p3r');
  },
};
