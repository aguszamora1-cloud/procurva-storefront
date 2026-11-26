/**
 * Atelier 2 (src/templates/atelier2): pruebas de A7.
 *
 * Parte 1, siempre (sin red ni navegador):
 *  - paleta (colors.ts): con paletas reales, extremas y 600 al azar, el texto,
 *    los grises, el encabezado, el pie y los botones llegan a 4,5:1, y los bordes
 *    de campos y el contorno del botón principal a 3:1; un color que ya cumple no
 *    se toca y uno que no cumple conserva su tono (no se vuelve blanco y negro);
 *  - avisos de la bolsa: el «%» queda pegado al número sin cambiar el texto;
 *  - código: sin useCart(), escalones con TierPicker/TierUnits, color agotado
 *    deshabilitado, portada según hero_enabled/hero_mode, sin emojis, CSS limitado
 *    a .a2 y reglas de 44 px; aislamiento: ninguna otra plantilla importa ni pinta
 *    Atelier 2.
 *
 * Parte 2, navegador (sólo con ATELIER2_URL, por ejemplo http://localhost:5431):
 *  datos reales y mínimos, sin portada, paletas clara y oscura, estados vacíos;
 *  inicio, catálogo, ficha, bolsa y /carrito; 1440 y 390 px. Comprueba: sin
 *  desborde horizontal, sin errores de página, contraste del texto visible contra
 *  su fondo real y controles de 44 px en celular. Sólo lectura: toda escritura se
 *  corta en la red. Playwright se toma de PLAYWRIGHT_MODULE o de 'playwright'.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = resolve(repoRoot, 'src/templates/atelier2');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/template-atelier2-test');
mkdirSync(CACHE_DIR, { recursive: true });
const read = (p) => readFileSync(resolve(repoRoot, p), 'utf8');
const kitFiles = readdirSync(KIT).filter((f) => /\.(tsx?|css)$/.test(f));

async function load(name, contents) {
  const outfile = resolve(CACHE_DIR, `${name}-${process.pid}.mjs`);
  await build({
    stdin: { contents, resolveDir: repoRoot, loader: 'ts' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    alias: { '@': resolve(repoRoot, 'src') },
    define: { 'import.meta.env': '{}' },
    logLevel: 'silent',
    outfile,
  });
  return import(pathToFileURL(outfile).href);
}
const M = await load(
  'kit',
  `export { atelier2Colors, atelier2Vars, shiftTo } from './src/templates/atelier2/colors.ts';
   export { contrastRatio, parseHex, blend } from './src/lib/contrast.ts';`,
);

// ── Parte 1 · paleta ──────────────────────────────────────────────────────────
const cr = (a, b) => M.contrastRatio(M.parseHex(a), M.parseHex(b));
/** Resuelve `color-mix(in srgb, A P%, B)` como lo pinta el navegador (mezcla lineal en sRGB). */
function mix(value) {
  const m = value.match(/^color-mix\(in srgb, (#[0-9a-f]{3,6}) (\d+)%, (#[0-9a-f]{3,6})\)$/i);
  if (!m) return value;
  const c = M.blend(M.parseHex(m[1]), M.parseHex(m[3]), Number(m[2]) / 100).map(Math.round);
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const pal = (colorPrimary, colorSecondary, colorAccent, colorBackground, colorText, headerBackground = null) => ({ colorPrimary, colorSecondary, colorAccent, colorBackground, colorText, headerBackground });
const PALETTES = {
  rosario: pal('#ff0000', '#f5f5f5', '#16a34a', '#ffffff', '#000000'),
  desdeabajo: pal('#2fa9e6', '#000000', '#16a34a', '#030303', '#ffffff'),
  'rojo puro': pal('#ff0000', '#ff0000', '#ff0000', '#ffffff', '#111111'),
  oscura: pal('#ffffff', '#000000', '#ffff00', '#000000', '#ffffff'),
  'amarillo claro': pal('#ffff00', '#fffde7', '#ffeb3b', '#fffff0', '#9e9e9e'),
  'texto rojo': pal('#000000', '#f5f5f5', '#16a34a', '#ffffff', '#ff0000'),
  'principal = fondo': pal('#ffffff', '#f5f5f5', '#16a34a', '#ffffff', '#111111'),
  'gris sobre gris': pal('#333333', '#777777', '#16a34a', '#808080', '#707070'),
  'texto = fondo': pal('#000000', '#ffffff', '#000000', '#ffffff', '#ffffff'),
  'encabezado propio': pal('#000000', '#f5f5f5', '#16a34a', '#ffffff', '#111111', '#1e3a8a'),
  'encabezado claro': pal('#000000', '#f5f5f5', '#16a34a', '#111111', '#eeeeee', '#fafafa'),
};
// 600 paletas al azar, con semilla fija (reproducibles).
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const hex = () => `#${Array.from({ length: 3 }, () => Math.floor(rnd() * 256).toString(16).padStart(2, '0')).join('')}`;
for (let i = 0; i < 600; i++) PALETTES[`azar ${i}`] = pal(hex(), hex(), hex(), hex(), hex(), rnd() < 0.2 ? hex() : null);

test('paleta: texto, grises, encabezado, pie y botones a 4,5:1; bordes y contorno a 3:1', () => {
  const fails = [];
  for (const [name, p] of Object.entries(PALETTES)) {
    const v = M.atelier2Vars(p);
    const c = M.atelier2Colors(p);
    const check = (what, ratio, min) => { if (!(ratio >= min)) fails.push(`${name} · ${what}: ${ratio.toFixed(2)} < ${min}`); };
    check('texto / fondo', cr(v['--a2-text'], v['--a2-bg']), 4.5);
    // Etiquetas, filtros activos y guía de talles: texto sobre --a2-line-soft (7 % del texto sobre el fondo).
    check('texto / superficie suave', cr(v['--a2-text'], v['--a2-line-soft']), 4.5);
    check('texto secundario / fondo', cr(mix(v['--a2-muted']), v['--a2-bg']), 4.5);
    check('texto tenue / fondo', cr(mix(v['--a2-subtle']), v['--a2-bg']), 4.5);
    check('encabezado / su fondo', cr(v['--a2-header-text'], v['--a2-header-bg']), 4.5);
    check('navegación / encabezado', cr(mix(v['--a2-header-muted']), v['--a2-header-bg']), 4.5);
    check('pie / secundario', cr(v['--a2-on-secondary'], v['--a2-secondary']), 4.5);
    check('pie tenue / secundario', cr(mix(v['--a2-foot-muted']), v['--a2-secondary']), 4.5);
    check('botón principal (texto)', cr(v['--a2-on-primary'], v['--a2-primary']), 4.5);
    check('botón de acento (texto)', cr(v['--a2-on-accent'], v['--a2-accent']), 4.5);
    check('acento como texto / fondo', cr(v['--a2-accent-ink'], v['--a2-bg']), 4.5);
    check('borde de campos / fondo', cr(mix(v['--a2-edge']), v['--a2-bg']), 3);
    // El botón principal se distingue del fondo por su relleno o por su contorno.
    check('botón principal / fondo', Math.max(cr(c.primary.fill, v['--a2-bg']), cr(v['--a2-primary-edge'], v['--a2-bg'])), 3);
  }
  assert.deepEqual(fails, [], fails.slice(0, 20).join('\n'));
});

test('paleta: no toca lo que ya cumple y conserva el tono de lo que no cumple', () => {
  // Ya cumple: el texto y el contorno quedan iguales (Rosario y desdeabajo no cambian).
  assert.equal(M.atelier2Colors(PALETTES.rosario).text, '#000000');
  assert.equal(M.atelier2Colors(PALETTES.desdeabajo).text, '#ffffff');
  assert.equal(M.atelier2Colors(PALETTES.rosario).primaryEdge, M.atelier2Colors(PALETTES.rosario).primary.fill);
  // No cumple: se corrige hacia el polo, sin terminar en blanco o negro puros.
  const grey = M.atelier2Colors(PALETTES['amarillo claro']).text;
  assert.notEqual(grey, '#9e9e9e');
  assert.ok(!['#000000', '#ffffff'].includes(grey), grey);
  const [r, g, b] = M.parseHex(grey);
  assert.ok(r === g && g === b, `el gris sigue siendo gris: ${grey}`);
  const red = M.parseHex(M.atelier2Colors(PALETTES['texto rojo']).text);
  assert.ok(red[0] > 150 && red[1] < 40 && red[2] < 40, `el rojo sigue siendo rojo: ${red}`);
  // El color guardado no se modifica (la entrada queda igual).
  const input = { ...PALETTES['amarillo claro'] };
  M.atelier2Colors(input);
  assert.deepEqual(input, PALETTES['amarillo claro']);
});

// ── Parte 1 · avisos de la bolsa ──────────────────────────────────────────────
test('avisos de la bolsa: el «%» queda pegado al número sin cambiar el texto', async () => {
  const src = read('src/templates/atelier2/Cart.tsx');
  const line = src.split(/\r?\n/).find((l) => l.startsWith('export const keepPercent'));
  assert.ok(line, 'keepPercent existe');
  const keepPercent = eval(line.replace('export const keepPercent = (s: string) =>', '(s) =>'));
  const NB = ' ';
  assert.equal(keepPercent('ahorrá 20 %'), `ahorrá 20${NB}%`);
  assert.equal(keepPercent('pagá −15 %'), `pagá −15${NB}%`);
  assert.equal(keepPercent('un 15% de descuento'), 'un 15% de descuento');
  assert.equal(keepPercent('Llevá 2 y ahorrá $500 por unidad'), 'Llevá 2 y ahorrá $500 por unidad');
  // Misma frase que la pieza compartida.
  assert.match(src, /Agregá \{n\.missing\} más y ahorrá — \{keepPercent\(n\.message\)\}/);
  assert.match(read('src/templates/shared/ClassicExtras.tsx'), /Agregá \{n\.missing\} más y ahorrá — \{n\.message\}/);
});

// ── Parte 1 · código ──────────────────────────────────────────────────────────
test('código del kit: bolsa, escalones, color agotado, portada y sin emojis', () => {
  const all = kitFiles.map((f) => [f, readFileSync(resolve(KIT, f), 'utf8')]);
  for (const [f, src] of all) {
    if (f.endsWith('.css')) continue;
    assert.doesNotMatch(src, /\buseCart\s*\(/, `${f}: useCart() directo`);
    // Emojis de la interfaz (no cuenta © ni ®, que Unicode también marca como pictográficos).
    assert.doesNotMatch(src.replace(/[©®™]/g, ''), /\p{Extended_Pictographic}/u, `${f}: emoji`);
  }
  const product = read('src/templates/atelier2/Product.tsx');
  assert.match(product, /<TierPicker /);
  assert.match(product, /<TierUnits /);
  const choices = read('src/templates/atelier2/Choices.tsx');
  assert.ok((choices.match(/disabled=\{out\}/g) || []).length >= 2, 'color y talle agotados deshabilitados');
  const hero = read('src/templates/atelier2/Hero.tsx');
  assert.match(hero, /config\.heroMode !== 'image_only'/, 'image_only: sin texto encima');
  assert.match(read('src/templates/atelier2/Home.tsx'), /'hero'/, 'la portada es una sección nativa (hero_enabled la apaga)');
});

/** Selectores de nivel superior del CSS, respetando paréntesis (:where(a, b)). */
function topSelectors(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let depth = 0;
  let buf = '';
  const blocks = [];
  for (const ch of css) {
    if (ch === '{') {
      const head = buf.trim();
      const inAt = blocks.length > 0 && blocks.every((b) => b.startsWith('@media') || b.startsWith('@supports'));
      if ((depth === 0 || inAt) && !head.startsWith('@') && !/^(from|to|\d+%)$/.test(head)) {
        let level = 0;
        let cur = '';
        for (const c of head) {
          if (c === '(') level++;
          if (c === ')') level--;
          if (c === ',' && level === 0) { out.push(cur.trim()); cur = ''; } else cur += c;
        }
        out.push(cur.trim());
      }
      blocks.push(head);
      depth++;
      buf = '';
    } else if (ch === '}') { depth--; blocks.pop(); buf = ''; } else if (ch === ';' && depth > 0) buf = ''; else buf += ch;
  }
  return out.filter(Boolean);
}

test('CSS del kit: todo limitado a Atelier 2 y reglas de 44 px', () => {
  const css = read('src/templates/atelier2/atelier2.css');
  // Cada selector tiene que nombrar una clase del kit (.a2, .a2-*, .tpl-atelier2): así no alcanza a otras plantillas.
  const loose = topSelectors(css).filter((s) => !/\.a2(?![\w-])|\.a2-[\w-]|\.tpl-atelier2(?![\w-])/.test(s));
  assert.deepEqual(loose, [], `selectores que alcanzan otras plantillas: ${loose.join(' | ')}`);
  for (const rule of [/\.a2-logo \{[^}]*min-width: 44px/, /\.a2-skip \{[^}]*min-height: 44px/, /\.a2-card__n::after \{ content: ''; position: absolute; inset: 0; \}/, /\.a2-card \{ position: relative;/]) assert.match(css, rule);
});

test('aislamiento: sólo TemplateApp monta Atelier 2 y el kit no usa otras plantillas', () => {
  const tplDir = resolve(repoRoot, 'src/templates');
  for (const dir of readdirSync(tplDir, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === 'atelier2') continue;
    for (const f of readdirSync(resolve(tplDir, dir.name))) {
      if (!/\.(tsx?|css)$/.test(f)) continue;
      const src = readFileSync(resolve(tplDir, dir.name, f), 'utf8');
      assert.doesNotMatch(src, /atelier2\/|from '\.\/atelier2|a2-[a-z]/, `${dir.name}/${f} no debe usar Atelier 2`);
    }
  }
  for (const f of kitFiles) {
    const src = readFileSync(resolve(KIT, f), 'utf8');
    assert.doesNotMatch(src, /from '\.\.\/(atelier|distrito|momentum)\//, `atelier2/${f} no importa otras plantillas`);
  }
  assert.match(read('src/templates/TemplateApp.tsx'), /import\('\.\/atelier2\/Atelier2'\)/, 'carga diferida desde TemplateApp');
});

// ── Parte 2 · navegador ───────────────────────────────────────────────────────
const URL = process.env.ATELIER2_URL;
let chromium = null;
if (URL) {
  try {
    const req = createRequire(import.meta.url);
    ({ chromium } = req(process.env.PLAYWRIGHT_MODULE || 'playwright'));
  } catch {
    chromium = null;
  }
}
const browserSkip = !URL ? 'sin ATELIER2_URL' : !chromium ? 'sin Playwright (PLAYWRIGHT_MODULE)' : false;

const READ = /\/rest\/v1\/rpc\/(get_|tryon|storefront_coupon|catalog_cart)/;
const Q = 'pc_dev_tpl=atelier&pc_dev_atelier=2';
const setPal = (p) => (j) => Object.assign(j.settings, { color_primary: p.colorPrimary, color_secondary: p.colorSecondary, color_accent: p.colorAccent, color_background: p.colorBackground, color_text: p.colorText });
const SCENARIOS = {
  reales: () => {},
  'datos mínimos': (j) => {
    j.logo_url = '';
    Object.assign(j.settings, { logo_url: '', hero_image_url: '', hero_image_url_mobile: '', banner_url: '', hero_title: '', hero_subtitle: '', hero_cta_text: '', storefront_announcement: '', section_newsletter: true });
    delete j.settings.promo_banner;
  },
  'sin portada': (j) => { j.settings.hero_enabled = false; },
  'paleta clara': setPal(PALETTES['amarillo claro']),
  'paleta oscura': setPal(PALETTES.oscura),
};

/** Medición dentro de la página: desborde, contraste del texto visible y controles chicos. */
function measure([mobile, scope]) {
  // scope: '.a2' (la página) o '.a2-bag' (sólo la bolsa abierta: lo de atrás queda bajo el velo).
  scope = scope || '.a2';
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  // Cualquier color CSS (rgb, color(srgb …), color-mix ya resuelto) → [r, g, b, a] con el motor del navegador.
  const parse = (s) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (top, under, a) => top.slice(0, 3).map((v, i) => v * a + under[i] * (1 - a));
  // Fondo real detrás de `el`: se componen los fondos semitransparentes hasta uno opaco; null si hay una imagen.
  const backdrop = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const st = getComputedStyle(n);
      if (st.backgroundImage !== 'none' && !/gradient/.test(st.backgroundImage)) return null;
      const c = parse(st.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 0.99) break;
    }
    let base = [255, 255, 255];
    for (const c of layers.reverse()) base = over(c, base, c[3]);
    return base;
  };
  const W = document.documentElement.clientWidth;
  const overflow = document.documentElement.scrollWidth - W;
  const low = [];
  const seen = new Set();
  for (const el of document.querySelectorAll(`${scope} *`)) {
    if (seen.size > 2500) break;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (!r.width || !r.height || st.visibility === 'hidden' || st.display === 'none') continue;
    if (el.closest('[aria-hidden="true"], .a2-sr, :disabled, [aria-disabled="true"], .a2-skip, .tpl-switcher')) continue;
    if (r.bottom < 0 && r.top < -2000) continue;
    seen.add(el);
    const bg = backdrop(el);
    if (!bg) continue; // texto sobre foto: lo cubre la protección propia de la portada
    let alpha = 1;
    for (let n = el; n; n = n.parentElement) alpha *= Number(getComputedStyle(n).opacity);
    const fg = parse(st.color);
    if (fg[3] * alpha < 0.1) continue; // invisible (por ejemplo, la fila de categorías plegada al bajar)
    const seenColor = over(fg, bg, fg[3] * alpha);
    const size = parseFloat(st.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(st.fontWeight) >= 700);
    const k = ratio(seenColor, bg);
    if (k < (large ? 3 : 4.5)) low.push(`«${el.textContent.trim().slice(0, 24)}» ${k.toFixed(2)}`);
  }
  const small = [];
  if (mobile) {
    for (const el of document.querySelectorAll(['a[href]', 'button', 'input:not([type="hidden"])', 'select', 'summary', '[role="radio"]'].map((x) => `${scope} ${x}`).join(', '))) {
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || el.closest('[aria-hidden="true"], .tpl-switcher')) continue;
      let r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      // Enlace estirado (::after absoluto): su área es la de su bloque contenedor.
      const after = getComputedStyle(el, '::after');
      if (after.content !== 'none' && after.position === 'absolute' && el.offsetParent) r = el.offsetParent.getBoundingClientRect();
      // Inputs reales de radio/checkbox: cuenta su etiqueta.
      if (el.matches('input[type="radio"], input[type="checkbox"]')) { const l = el.closest('label'); if (l) r = l.getBoundingClientRect(); }
      // Excepción de WCAG 2.5.8: enlaces dentro de un párrafo de texto.
      if (el.matches('a') && el.parentElement && el.parentElement.matches('p') && el.parentElement.textContent.trim() !== el.textContent.trim()) continue;
      if (r.height < 43.5 || r.width < 43.5) small.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)} «${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}»`);
    }
  }
  return { overflow, low: [...new Set(low)], small: [...new Set(small)] };
}

test('navegador: escenarios × páginas × anchos sin desbordes, con contraste y controles de 44 px', { skip: browserSkip, timeout: 30 * 60 * 1000 }, async () => {
  const b = await chromium.launch();
  const fails = [];
  let checked = 0;
  try {
    const guard = async (ctx, mod) => {
      await ctx.route('**/*', async (r) => {
        const q = r.request(); const m = q.method(); const u = q.url();
        if (/\/functions\/v1\//.test(u) || (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && !READ.test(u))) return r.abort();
        if (mod && /get_storefront_by_slug/.test(u)) { const res = await r.fetch(); const j = await res.json(); j.settings = j.settings || {}; mod(j); return r.fulfill({ response: res, json: j }); }
        return r.continue();
      });
      // El popup del newsletter es de Classic y aparece con demora: no forma parte de las pantallas medidas.
      await ctx.addInitScript(() => { const add = () => { const s = document.createElement('style'); s.textContent = '.z-\\[1100\\]{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important}'; document.head.appendChild(s); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); });
    };
    // Una línea real en la bolsa (primer producto sin escalones), para medir la bolsa con contenido.
    const probe = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await guard(probe);
    const pp = await probe.newPage();
    await pp.goto(`${URL}/productos?${Q}`);
    await pp.waitForSelector('.a2-card__n', { timeout: 60000 });
    const hrefs = (await pp.$$eval('.a2-card__n', (e) => e.map((a) => a.getAttribute('href')))).slice(0, 8);
    let cart = null;
    let ficha = hrefs[0];
    for (const h of hrefs) {
      await pp.goto(`${URL}${h}${h.includes('?') ? '&' : '?'}${Q}`);
      await pp.waitForSelector('h1');
      await pp.waitForTimeout(2000);
      if (await pp.locator('[aria-label="Elegí cuántas llevás"]').count()) continue;
      for (const sel of ['.a2-sw__b:not([disabled])', '.a2-sz__b:not([disabled])']) { const l = pp.locator(sel).first(); if (await l.count()) await l.click(); }
      await pp.locator('.a2-btn--buy').click();
      await pp.waitForTimeout(1000);
      cart = await pp.evaluate(() => localStorage.getItem('procurva_storefront_cart_v1'));
      ficha = h;
      if (cart) break;
    }
    await probe.close();
    const PAGES = [
      ['inicio', '/', false],
      ['catálogo', '/productos', false],
      ['búsqueda vacía', '/productos?q=zzzzqqqq', false],
      ['ficha', ficha, false],
      ['bolsa', '/', true],
      ['carrito', '/carrito', false],
      ['carrito vacío', '/carrito', 'vacío'],
    ];
    for (const [sn, mod] of Object.entries(SCENARIOS)) {
      for (const [pn, path, withCart] of PAGES) {
        for (const vp of [1440, 390]) {
          const mobile = vp < 500;
          const ctx = await b.newContext({ viewport: { width: vp, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile });
          await guard(ctx, mod);
          if (cart && withCart !== 'vacío') await ctx.addInitScript((c) => { try { localStorage.setItem('procurva_storefront_cart_v1', c); } catch {} }, cart);
          const p = await ctx.newPage();
          const errors = [];
          p.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
          await p.goto(`${URL}${path}${path.includes('?') ? '&' : '?'}${Q}`);
          await p.waitForSelector('main', { timeout: 60000 });
          await p.waitForTimeout(2500);
          if (withCart === true) { await p.locator('.a2-hd__bag').click(); await p.waitForSelector('.a2-bag', { timeout: 10000 }); await p.waitForTimeout(600); }
          else await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((s) => setTimeout(s, 80)); } window.scrollTo(0, 0); });
          const r = await p.evaluate(measure, [mobile, withCart === true ? '.a2-bag' : null]);
          const name = `${sn} · ${pn} · ${vp}`;
          if (r.overflow > 0) fails.push(`${name}: desborde de ${r.overflow} px`);
          if (errors.length) fails.push(`${name}: errores ${errors.join(' | ')}`);
          if (r.low.length) fails.push(`${name}: contraste bajo ${r.low.slice(0, 4).join(' | ')}`);
          if (r.small.length) fails.push(`${name}: controles de menos de 44 px ${r.small.slice(0, 4).join(' | ')}`);
          checked++;
          await ctx.close();
        }
      }
    }
  } finally {
    await b.close();
  }
  assert.ok(checked >= 60, `pantallas medidas: ${checked}`);
  assert.deepEqual(fails, [], fails.join('\n'));
});
