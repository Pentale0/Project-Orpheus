# NOCTURNE ARCANUM

A fictional manga & figurine storefront with a dark, angular JRPG-menu interface.

Original design, original artwork, original copy. No third-party game assets,
logos, characters, or fonts are used or referenced.

---

## Run it

There is no build step — it's plain HTML, CSS and vanilla JavaScript.

```bash
# Option 1: just open the file
start index.html

# Option 2: serve it (recommended, so the fonts and assets behave)
npx serve .
# then visit the URL it prints
```

Any static server works. `python -m http.server 8000` is fine too.

---

## Files

```
index.html        markup for the whole page
styles.css        all styling, organised into 16 commented sections
script.js         all behaviour, split into 8 commented features
assets/           10 original SVG placeholder images
scripts/check.mjs optional self-test (see below)
```

### Where to edit things

| Want to change… | Look in |
|---|---|
| Colours, fonts, corner-cut sizes | `styles.css` → section 1 (`:root`) |
| Products | `index.html` → `.card` elements inside `#productGrid` |
| Filter categories | the `data-cat` attribute on each card + `data-filter` on the stacked menu |
| Anything cart-related | `script.js` → section G |
| Free shipping threshold | `script.js` → `FREE_SHIPPING_AT` |

---

## Design notes

**Palette** — near-black navy base (`--void`), layered navy panels, electric
blue (`--electric`) and cyan (`--cyan`) for accents and glows, pale ice-blue
text (`--ice`). Exactly one warm colour exists in the whole design
(`--amber`) and it is reserved for primary calls to action and live badges, so
it always means "the important thing".

**Shapes** — no rounded corners anywhere. Angles come from `clip-path`
polygons declared once as custom properties (`--shape-card`, `--shape-panel`,
`--shape-tag`, `--shape-par`), which keeps cuts consistent across cards, buttons,
tags and the nav.

**Depth** — three fixed layers sit behind everything: an engineering grid,
CRT scanlines, and an SVG noise tile. Panel gradients plus cyan `box-shadow`
glows do the rest.

**Motion** — three duration tokens keep it snappy and consistent: `--snap`
(140ms, hovers), `--swift` (240ms, panels), `--push` (420ms, drawers and
large reveals). Everything respects `prefers-reduced-motion`.

**Responsive** — four breakpoints. The main ones: below 720px the nav collapses
into a burger and the stacked menu bars drop their skew so they stay easy to
tap; below 400px the product grid goes single-column.

---

## Features

- Slanted navigation with an inverted-colour active state and hover arrow markers
- Clock dial + moon motifs built from inline SVG
- Filterable product grid (everything / manga / figures / new arrivals)
- Working cart: add, quantity step, remove, subtotal, free-shipping progress
- Cart persists to `localStorage` and restores on reload
- Slide-in cart drawer with focus restore and Escape-to-close
- Scroll-reveal animations with per-element stagger via `--i`
- Scroll-spy that highlights the current nav item
- Accessible: skip link, ARIA labels, focus management, visible focus rings

---

## Self-test

```bash
node scripts/check.mjs
```

Audits the rendered page for the design-system rules above, confirms every
asset reference resolves, and checks that no framework crept in. Requires a
captured DOM dump to be passed as the first argument.

---

## Note

This is a layout/design demonstration. The store, products, prices and contact
details are invented, and checkout does not process payments.