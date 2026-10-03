/* =====================================================================
   NOCTURNE ARCANUM — script.js
   ---------------------------------------------------------------------
   Vanilla JavaScript only. No libraries. Each section below is a small,
   self-contained feature so you can delete what you don't need.

     A.  Small helpers
     B.  Sticky header
     C.  Mobile menu
     D.  Highlight the nav link for the section you're in
     E.  Fade elements in as they scroll into view
     F.  Filter the product grid
     G.  Shopping cart (add / qty / remove / totals / drawer / toast)
     H.  Signup form
   ===================================================================== */

'use strict';


/* ==================== A. SMALL HELPERS ==================== */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Formats 24 → "$24.00" */
const money = (n) => '$' + n.toFixed(2);

/** Restricts scroll-triggered work to when the tab is actually visible. */
const onIdle = (fn) =>
  'requestIdleCallback' in window
    ? requestIdleCallback(fn, { timeout: 400 })
    : setTimeout(fn, 220);


/* ==================== B. STICKY HEADER ==================== */

const siteHead = $('#siteHead');

function initHeader() {
  // Add .is-stuck (a solid background) once you scroll past the hero top.
  const onScroll = () => {
    siteHead.classList.toggle('is-stuck', window.scrollY > 60);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}


/* ==================== C. MOBILE MENU ==================== */

function initMobileMenu() {
  const burger = $('#burger');
  const nav    = $('#primaryNav');

  const setOpen = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
  };

  burger.addEventListener('click', () => {
    setOpen(burger.getAttribute('aria-expanded') !== 'true');
  });

  // Tapping a link closes the menu and scrolls to the section.
  $$('a', nav).forEach((a) => a.addEventListener('click', () => setOpen(false)));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  // If the window grows past the mobile breakpoint, reset the menu.
  window.addEventListener('resize', () => {
    if (window.innerWidth > 720) setOpen(false);
  });
}


/* ==================== D. ACTIVE NAV LINK ==================== */

function initActiveNav() {
  const links = $$('[data-nav]');
  const sections = $$('main section[id]');
  if (!links.length || !sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = `#${entry.target.id}`;

        // Clear every link, then light up the first one pointing here.
        links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === id));
      });
    },
    // A band across the upper-middle of the viewport decides "current".
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  );

  sections.forEach((s) => observer.observe(s));
}


/* ==================== E. SCROLL REVEAL ==================== */

function initReveal() {
  const items = $$('.reveal');
  if (!items.length) return;

  // Browsers without IntersectionObserver just show everything.
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target); // run once, then stop watching
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );

  items.forEach((el) => observer.observe(el));
}


/* ==================== F. PRODUCT FILTER ==================== */

function initFilter() {
  const buttons = $$('#filterStack [data-filter]');
  const cards   = $$('#productGrid .card');
  const empty   = $('#gridEmpty');
  const result  = $('#resultCount');
  const grid    = $('#productGrid');
  if (!buttons.length) return;

  /** Shows only cards whose data-cat list contains `key`. */
  function apply(key) {
    let shown = 0;

    cards.forEach((card) => {
      const cats = (card.dataset.cat || '').split(/\s+/);
      const match = key === 'all' || cats.includes(key);
      card.classList.toggle('is-filtered', !match);
      if (match) shown++;
    });

    // Replay the entrance animation on whatever is now visible.
    $$('.card:not(.is-filtered)', grid).forEach((card, i) => {
      card.style.setProperty('--i', Math.min(i, 7));
      card.classList.remove('is-in');
      requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-in')));
    });

    buttons.forEach((b) => b.classList.toggle('is-active', b.dataset.filter === key));
    result.textContent = `Showing ${shown} of ${cards.length}`;
    empty.hidden = shown > 0;
  }

  buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.filter)));

  // "Show everything" link inside the empty state.
  $('[data-reset]', empty).addEventListener('click', () => {
    apply('all');
    scrollToCollection();
  });

  // Expose it so header/footer links ("Figurines") can drive the grid too.
  window.applyProductFilter = apply;
}

/** Smoothly scrolls to the product grid. */
function scrollToCollection() {
  const grid = $('#collection');
  if (!grid) return;
  const y = grid.getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top: y, behavior: 'smooth' });
}


/* ==================== G. SHOPPING CART ==================== */

/* Items that can be added without appearing as a card in the grid
   (for example the "Reserve a copy" button in the banner). */
const EXTRA_ITEMS = {
  'VB-03': {
    title: 'Vesper Blade — Vol. 3',
    price: 26.0,
    art:   'assets/vesper-3.svg',
  },
};

const FREE_SHIPPING_AT = 80;
const STORAGE_KEY = 'nocturne.cart.v1';

/** Cart state lives in one plain array: [{ id, title, price, art, qty }] */
let cart = loadCart();

const els = {
  count:     $('#cartCount'),
  items:     $('#cartItems'),
  empty:     $('#cartEmpty'),
  subtotal:  $('#cartSubtotal'),
  ship:      $('#cartShip'),
  drawer:    $('#cartDrawer'),
  toast:     $('#toast'),
};

/* --- persistence ------------------------------------------------ */

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(raw) ? raw.filter((i) => i && i.id && i.qty > 0) : [];
  } catch {
    return []; // corrupted or unavailable storage → start empty
  }
}

function saveCart() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* private mode / quota — the cart just won't persist */
  }
}

/* --- mutations -------------------------------------------------- */

function addToCart(id) {
  const existing = cart.find((i) => i.id === id);

  if (existing) {
    existing.qty += 1;
  } else {
    // Prefer the card's own data-attributes so there's one source of truth.
    const card = $(`.card[data-id="${CSS.escape(id)}"]`);
    const product = {
      id,
      title: card?.dataset.title || EXTRA_ITEMS[id]?.title || id,
      price: parseFloat(card?.dataset.price ?? EXTRA_ITEMS[id]?.price ?? 0),
      art:   card?.dataset.art   || EXTRA_ITEMS[id]?.art   || 'assets/vesper-1.svg',
      qty:   1,
    };
    cart.push(product);
  }

  saveCart();
  renderCart();
  toast(`${addedName(id)} added`);
}

function changeQty(id, delta) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;

  item.qty += delta;
  // Drop the line entirely when it hits zero.
  if (item.qty <= 0) cart = cart.filter((i) => i.id !== id);

  saveCart();
  renderCart();
}

function removeItem(id) {
  cart = cart.filter((i) => i.id !== id);
  saveCart();
  renderCart();
}

const addedName = (id) =>
  cart.find((i) => i.id === id)?.title.split('—')[0].trim() || 'Item';

/* --- rendering -------------------------------------------------- */

function renderCart() {
  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  const total = cart.reduce((sum, i) => sum + i.qty * i.price, 0);

  /* header badge */
  els.count.textContent = count;
  els.count.dataset.empty = String(count === 0);

  /* "already in the cart" highlight on each card */
  $$('#productGrid .card').forEach((card) => {
    card.classList.toggle('is-in-cart', cart.some((i) => i.id === card.dataset.id));
  });

  /* drawer list */
  els.empty.hidden = cart.length > 0;
  $$('.cart-line', els.items).forEach((n) => n.remove());

  cart.forEach((item) => {
    const line = document.createElement('div');
    line.className = 'cart-line';
    line.dataset.line = item.id;

    // Build with innerHTML — all values come from our own arrays, never user input.
    line.innerHTML = `
      <img class="cart-line__img" src="${item.art}" alt="" width="62" height="78">
      <div>
        <p class="cart-line__name"></p>
        <div class="cart-line__qty">
          <button type="button" data-dec aria-label="Decrease quantity">&minus;</button>
          <span>${item.qty}</span>
          <button type="button" data-inc aria-label="Increase quantity">+</button>
          <button type="button" class="cart-line__rm" data-rm>Remove</button>
        </div>
      </div>
      <span class="cart-line__price">${money(item.price * item.qty)}</span>
    `;
    // textContent for the title so it's always treated as plain text.
    $('.cart-line__name', line).textContent = item.title;

    $('[data-dec]', line).addEventListener('click', () => changeQty(item.id, -1));
    $('[data-inc]', line).addEventListener('click', () => changeQty(item.id,  1));
    $('[data-rm]',  line).addEventListener('click', () => removeItem(item.id));

    els.items.appendChild(line);
  });

  /* totals */
  els.subtotal.textContent = money(total);
  const left = FREE_SHIPPING_AT - total;
  if (cart.length === 0) {
    els.ship.textContent = `Add ${money(FREE_SHIPPING_AT)} more for free shipping.`;
    els.ship.classList.remove('is-free');
  } else if (left > 0) {
    els.ship.textContent = `Add ${money(left)} more for free shipping.`;
    els.ship.classList.remove('is-free');
  } else {
    els.ship.textContent = 'Free worldwide shipping unlocked.';
    els.ship.classList.add('is-free');
  }
}

/* --- drawer open/close ------------------------------------------ */

let lastFocused = null;

function openCart() {
  lastFocused = document.activeElement;
  els.drawer.classList.add('is-open');
  els.drawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // stop background scrolling
  onIdle(() => $('.drawer__close').focus());
}

function closeCart() {
  els.drawer.classList.remove('is-open');
  els.drawer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  lastFocused?.focus();
}

/* --- toast ------------------------------------------------------- */

let toastTimer;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('is-on'), 2200);
}

/* --- wiring ------------------------------------------------------ */

function initCart() {
  // "Add to cart" buttons on the cards
  $$('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      addToCart(btn.closest('.card').dataset.id);
    });
  });

  // Quick-add buttons elsewhere on the page (the banner)
  $$('[data-quick]').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(btn.dataset.quick));
  });

  $('#cartBtn').addEventListener('click', openCart);

  // Scrim and ✕ both close the drawer
  $$('[data-close-cart]').forEach((el) => el.addEventListener('click', closeCart));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.drawer.classList.contains('is-open')) closeCart();
  });

  // Checkout is not wired to a real store — just confirm.
  $('#checkoutBtn').addEventListener('click', () => {
    if (!cart.length) return toast('Your cart is empty');
    closeCart();
    toast('Demo store — no payment taken');
  });

  renderCart(); // paints the restored cart on page load
}


/* ==================== H. SIGNUP FORM ==================== */

function initSignup() {
  const form = $('#signupForm');
  const note = $('#signupNote');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault(); // nothing is actually sent anywhere
    const input = $('#email');
    if (!input.value.trim() || !input.checkValidity()) {
      note.textContent = 'Enter a valid email address.';
      note.style.color = 'var(--amber)';
      input.focus();
      return;
    }
    note.textContent = 'Added. Watch for the next drop.';
    note.style.color = 'var(--cyan)';
    input.value = '';
  });
}


/* ==================== HEADER/FOOTER FILTER SHORTCUTS ==================== */

/* Some links say "Figurines" — they should also pre-filter the grid. */
function initCatJumps() {
  $$('[data-cat-jump]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.applyProductFilter?.(link.dataset.catJump);
      scrollToCollection();
      if (window.innerWidth <= 720) $('#burger').setAttribute('aria-expanded', 'false');
      $('#primaryNav').classList.remove('is-open');
    });
  });
}


/* ==================== BOOT ==================== */

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileMenu();
  initActiveNav();
  initReveal();
  initFilter();
  initCart();
  initSignup();
  initCatJumps();
});