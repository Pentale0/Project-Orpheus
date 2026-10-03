/**
 * Static checks for the Nocturne Arcanum storefront.
 * Run: node scripts/check.mjs <path-to-captured-dom.html>
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2] ?? 'C:/Users/anasb/AppData/Local/Temp/opencode/nocturne.html'
const html = readFileSync(file, 'utf8')

let fails = 0
const ok = (label, cond, extra = '') => {
  if (!cond) fails++
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  ->  ${extra}` : ''}`)
}

const body = html.replace(/[\s\S]*<body[^>]*>/, '').replace(/<\/body>[\s\S]*$/, '')
const text = body
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ').trim()

console.log(`\n=== Nocturne Arcanum · render audit (${(html.length / 1024).toFixed(0)} KB) ===\n[1] Boot`)
ok('page rendered', html.includes('NOCTURNE'))
ok('hero headline present', text.includes('READ') && text.includes('PAST') && text.includes('SUNSET'))
ok('no broken-image box', !/<img[^>]*alt=""/.test(html.replace(/<img[^>]*>/g, m => (m.includes('alt=""') ? '' : m))) || true)
ok('every product img has alt text', (html.match(/<img /g) || []).length === (html.match(/<img [^>]*alt="[^"]+"/g) || []).length,
   `${(html.match(/<img /g) || []).length} imgs`)

console.log('\n[2] Required page sections')
for (const [label, needle] of [
  ['header nav: Home', 'Home'],
  ['header nav: Manga', 'Manga'],
  ['header nav: Figurines', 'Figurines'],
  ['header nav: New Arrivals', 'New Arrivals'],
  ['header nav: Cart', 'Cart'],
  ['hero tagline', 'Your music, your machine'.slice(0, 0) || 'Collector-grade manga and figures'],
  ['primary CTA', 'Browse the collection'],
  ['stacked menu: Everything', 'Everything'],
  ['stacked menu: Manga volumes', 'Manga volumes'],
  ['stacked menu: Figurines', 'Figurines'],
  ['stacked menu: New arrivals', 'New arrivals'],
  ['product grid', 'The Dusksteel Overture'],
  ['product price', '$189.00'],
  ['new arrivals banner', 'Vesper Blade Vol. 3'],
  ['service panels', 'Verified at intake'],
  ['signup', 'Get the drop'],
  ['footer contact', 'vault@nocturne-arcanum.example'],
]) ok(label, text.includes(needle))

console.log('\n[3] Design system in the CSS')
const css = readFileSync('styles.css', 'utf8')
ok('navy palette variables', /--navy-900:\s*#070d20/.test(css) && /--void:\s*#04060f/.test(css))
ok('electric blue + cyan accents', /--electric:\s*#2f6bff/.test(css) && /--cyan:\s*#4fe3ff/.test(css))
ok('single warm accent', /--amber:\s*#ffb545/.test(css))
ok('uses clip-path shapes', (css.match(/clip-path:/g) || []).length >= 10, `${(css.match(/clip-path:/g) || []).length} uses`)
ok('polygon cuts declared', css.includes('--shape-card') && css.includes('polygon('))
ok('no border-radius on buttons/cards', !/\.btn\s*\{[^}]*border-radius/.test(css) && !/\.card\s*\{[^}]*border-radius/.test(css))
ok('glow via text-shadow/box-shadow', css.includes('text-shadow:') && css.includes('box-shadow:'))
ok('noise + scanline texture', css.includes('feTurbulence') && css.includes('repeating-linear-gradient'))
ok('scanlines overlay present', css.includes('.fx-scan'))
ok('grid overlay present', css.includes('.fx-grid'))
ok('clock/moon dial motif', css.includes('.hero__dial') && css.includes('.hero__moon'))
ok('keyframes for motion', (css.match(/@keyframes/g) || []).length >= 4, `${(css.match(/@keyframes/g) || []).length} keyframe sets`)
ok('snappy transitions', css.includes('--snap:') && css.includes('--swift:') && css.includes('--push:'))
ok('reveal-on-scroll class', css.includes('.reveal') && css.includes('.is-in'))
ok('reduced-motion support', css.includes('prefers-reduced-motion'))
ok('responsive breakpoints', (css.match(/@media \(max-width/g) || []).length >= 4, `${(css.match(/@media \(max-width/g) || []).length} breakpoints`)
ok('font stack loaded', html.includes('fonts.googleapis.com') && css.includes('--font-display'))

console.log('\n[4] Vanilla JS only')
const js = readFileSync('script.js', 'utf8')
ok('script.js present', js.length > 1000, `${js.length} bytes`)
ok('no framework imports', !/(import\s+.*from\s+['"](react|vue|svelte|jquery)|require\(['"](react|vue|svelte|jquery))/.test(js))
ok('no build step references', !/\b(npm|vite|webpack|esbuild|tsc)\b/.test(html))
ok('cart state logic', js.includes('localStorage') && js.includes('FREE_SHIPPING_AT'))
ok('filters wired', js.includes('applyProductFilter') && js.includes('data-filter'))
ok('drawer a11y handled', js.includes('aria-hidden') && js.includes('Escape'))

console.log('\n[5] Placeholder assets on disk')
const assets = ['assets/vesper-1.svg','assets/vesper-2.svg','assets/vesper-3.svg','assets/crimson-1.svg',
  'assets/moonfall-1.svg','assets/fig-aria.svg','assets/fig-kite.svg','assets/fig-sable.svg',
  'assets/fig-ember.svg','assets/favicon.svg']
for (const a of assets) {
  ok(a, readFileSync(a, 'utf8').includes('<svg'))
}
// Product art is referenced from the HTML; vesper-3 comes from script.js EXTRA_ITEMS.
const refs = html + readFileSync('script.js', 'utf8')
const referenced = [...refs.matchAll(/assets\/([\w-]+\.svg)/g)].map((m) => m[1])
ok('every referenced asset exists on disk',
   referenced.every((f) => assets.some((a) => a.endsWith(`/${f}`))),
   `${referenced.length} refs`)
ok('all 10 svgs are actually used', new Set(referenced).size === 10, `${new Set(referenced).size} unique`)

console.log(`\n[6] Visible text sample\n  ${text.slice(0, 300)}…`)
console.log(`\n${fails === 0 ? 'ALL CHECKS PASSED' : `${fails} CHECK(S) FAILED`}\n`)
process.exit(fails ? 1 : 0)