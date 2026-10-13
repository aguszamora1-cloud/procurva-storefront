// Pruebas del contraste WCAG de v2 (src/lib/contrast.ts) — Fase 2, paso 2.1.
//
// Corre con `npm run test:contrast`. Igual que test:typography: importa el .ts
// directo (Node >= 22.18 / 23.6) y NO está en `check`/`prebuild`.
//
// Qué garantiza:
//  1. La fórmula da los valores de referencia de WCAG.
//  2. En miles de combinaciones de texto, fondo y panel: el terciario corregido
//     llega a 4,5:1 sobre todas sus superficies siempre que el color del
//     comercio lo permita, y nunca queda más claro que hoy.
//  3. El secundario: nunca más claro que hoy, nunca por debajo de 4,5:1 cuando
//     se puede, siempre más firme que el terciario, y NO se toca cuando ya
//     cumple contraste y jerarquía.
//  4. Los temas de referencia (las 3 tiendas de prueba, crema, oscuro).
//  5. El CSS: el bloque de grises sólo existe bajo data-typography="v2" y dentro
//     de [data-ink='v2'], y cada variable `-aa` que usa la setea applyTheme.
//  6. ContrastScope en v1 devuelve un Fragment (DOM de siempre) y envuelve sólo
//     las rutas del alcance (nunca carrito ni checkout).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HIERARCHY_STEP,
  MUTED_ALPHA,
  MUTED_TARGET,
  PANEL_TINT_MAX,
  SUBTLE_ALPHA,
  TEXT_AA,
  ACCENT_TINT,
  STATUS_BASE,
  accentInk,
  alphaContrast,
  blend,
  contrastRatio,
  glassAlpha,
  greyAlphas,
  parseHex,
  readableFill,
  readableText,
  relativeLuminance,
} from '../src/lib/contrast.ts';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
};
const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const hex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');

// 1. Fórmula ------------------------------------------------------------------
test('valores de referencia WCAG', () => {
  assert.equal(contrastRatio([0, 0, 0], [255, 255, 255]).toFixed(2), '21.00');
  assert.equal(contrastRatio([255, 255, 255], [255, 255, 255]), 1);
  // #767676 es el gris más claro que cumple AA sobre blanco.
  assert.ok(contrastRatio(parseHex('#767676'), [255, 255, 255]) >= 4.5);
  assert.ok(contrastRatio(parseHex('#777777'), [255, 255, 255]) < 4.5);
  assert.deepEqual(parseHex('#abc'), [0xaa, 0xbb, 0xcc]);
  for (const bad of [null, undefined, '', 'var(--x)', '#12', '#zzzzzz', 'rgb(0,0,0)']) assert.equal(parseHex(bad), null);
});

test('color que no es hex → opacidades de hoy (no inventa nada)', () => {
  assert.deepEqual(greyAlphas('var(--x)', '#ffffff'), { muted: MUTED_ALPHA, subtle: SUBTLE_ALPHA });
  assert.deepEqual(greyAlphas('#111111', ''), { muted: MUTED_ALPHA, subtle: SUBTLE_ALPHA });
});

// 2 y 3. Barrido ----------------------------------------------------------------
const STEPS = [0, 34, 68, 102, 136, 170, 204, 238, 255];
const colors = [];
for (const r of STEPS) for (const g of STEPS) for (const b of STEPS) colors.push(hex([r, g, b]));
// Paneles: tinte claro / oscuro del fondo, o nada.
const panelsFor = (bg) => {
  const [r, g, b] = parseHex(bg);
  const shift = (d) => hex([r, g, b].map((c) => Math.max(0, Math.min(255, c + d))));
  return [null, shift(-10), shift(10), '#f5f5f5'];
};

test('barrido: AA cuando se puede, nunca más claro que hoy, jerarquía, sin cambios innecesarios', () => {
  let cases = 0;
  let mutedUntouched = 0;
  // Fondos: una muestra de 1 cada 7 colores; textos: todos.
  for (let i = 0; i < colors.length; i += 7) {
    const bg = colors[i];
    for (const panel of panelsFor(bg)) {
      const B = parseHex(bg);
      const P = panel ? parseHex(panel) : null;
      const surfaces = P && contrastRatio(B, P) < PANEL_TINT_MAX ? [B, P] : [B];
      for (const text of colors) {
        const T = parseHex(text);
        const worst = (a) => Math.min(...surfaces.map((s) => alphaContrast(T, s, a)));
        const { muted, subtle } = greyAlphas(text, bg, panel);
        cases++;
        const ctx = `texto ${text} fondo ${bg} panel ${panel}`;
        assert.ok(subtle >= SUBTLE_ALPHA && subtle <= 1, `subtle fuera de rango: ${ctx}`);
        assert.ok(muted >= MUTED_ALPHA && muted <= 1, `muted fuera de rango: ${ctx}`);
        assert.ok(muted >= subtle, `muted más claro que subtle: ${ctx}`);
        // ¿Alguna opacidad desde la de hoy llega? (la mezcla no siempre es
        // monótona: con tonos muy distintos, ej. bordó sobre verde agua, un 88 %
        // puede contrastar más que el 100 %).
        let reachable = false;
        for (let s = Math.round(SUBTLE_ALPHA * 100); s <= 100 && !reachable; s++) reachable = worst(s / 100) >= TEXT_AA;
        if (reachable) {
          assert.ok(worst(subtle) >= TEXT_AA, `subtle < 4,5: ${ctx}`);
          assert.ok(worst(muted) >= TEXT_AA, `muted < 4,5: ${ctx}`);
          // Mínimo: un paso menos ya no llegaría (salvo que sea el piso de hoy).
          if (subtle > SUBTLE_ALPHA) assert.ok(worst(subtle - 0.01) < TEXT_AA, `subtle no es el mínimo: ${ctx}`);
        } else {
          // El color del comercio no da AA ni al 100 %: lo más firme posible.
          assert.equal(subtle, 1, `sin AA posible, subtle debería ser 1: ${ctx}`);
        }
        const mutedToday = worst(MUTED_ALPHA);
        if (mutedToday >= TEXT_AA && mutedToday >= worst(subtle) * HIERARCHY_STEP) {
          assert.equal(muted, Math.max(MUTED_ALPHA, subtle), `muted cambió sin necesidad: ${ctx}`);
          mutedUntouched++;
        } else {
          // Llega al objetivo de jerarquía si alguna opacidad lo permite.
          const want = Math.max(TEXT_AA, Math.min(MUTED_TARGET, worst(subtle) * HIERARCHY_STEP));
          let wantReachable = false;
          for (let s = Math.round(Math.max(MUTED_ALPHA, subtle) * 100); s <= 100 && !wantReachable; s++) wantReachable = worst(s / 100) >= want;
          if (wantReachable) assert.ok(worst(muted) >= want, `muted no llega a su objetivo: ${ctx}`);
        }
      }
    }
  }
  assert.ok(cases > 50_000, `pocos casos: ${cases}`);
  assert.ok(mutedUntouched > 0, 'ningún caso conservó el muted de hoy');
});

// 4. Temas de referencia ------------------------------------------------------
const REF = [
  // [nombre, texto, fondo, panel, muted esperado sin cambios?]
  ['Elevel / mayorista', '#111111', '#ffffff', '#f5f5f5', false],
  ['Rosario Sportwear', '#000000', '#ffffff', '#f5f5f5', false],
  ['Crema', '#2b2b2b', '#f7f3ec', '#ece6dc', false],
  ['Oscuro', '#f5f5f5', '#111111', '#1c1c1c', true],
];
for (const [name, text, bg, panel, mutedSame] of REF) {
  test(`tema de referencia: ${name}`, () => {
    const { muted, subtle } = greyAlphas(text, bg, panel);
    const T = parseHex(text);
    for (const s of [parseHex(bg), parseHex(panel)]) {
      assert.ok(alphaContrast(T, s, subtle) >= 4.5);
      assert.ok(alphaContrast(T, s, muted) >= 4.5);
    }
    // Sigue habiendo tres niveles: el secundario no llega al texto pleno.
    assert.ok(muted < 1 && muted > subtle);
    if (mutedSame) assert.equal(muted, MUTED_ALPHA);
    else assert.ok(muted > MUTED_ALPHA);
  });
}

// 4b. Tinta del acento (C4) ---------------------------------------------------
const hue = ([r, g, b]) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  // Casi gris (ej. una tinta llevada casi a blanco): el tono no se percibe y el
  // redondeo a hex lo mueve unos grados. No se compara.
  if (d < 24) return null;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const inkSurfaces = (accent, bg, panel) => {
  const A = parseHex(accent), B = parseHex(bg), P = panel ? parseHex(panel) : null;
  const s = [B, blend(A, B, ACCENT_TINT)];
  if (P && contrastRatio(B, P) < PANEL_TINT_MAX) s.push(P);
  return s;
};

test('acento que ya cumple sale tal cual; lo que no es hex, también', () => {
  assert.equal(accentInk('#000000', '#ffffff', '#f5f5f5'), '#000000');
  // Azul: 5,17 sobre blanco pero 4,497 sobre su propio tinte del 10 % → se
  // corre un 1 % (imperceptible: ningún canal se mueve más de 2).
  const blue = parseHex(accentInk('#2563eb', '#ffffff', '#f5f5f5'));
  assert.ok(blue.every((c, i) => Math.abs(c - parseHex('#2563eb')[i]) <= 2));
  assert.equal(accentInk('#22c55e', '#111111', '#1c1c1c'), '#22c55e');
  assert.equal(accentInk('var(--x)', '#ffffff'), 'var(--x)');
  assert.equal(accentInk('#16a34a', ''), '#16a34a');
});

test('barrido de acentos: AA en fondo, tinte y panel, mínimo cambio, mismo tono', () => {
  let changed = 0;
  for (let i = 0; i < colors.length; i += 11) {
    const bg = colors[i];
    for (const panel of panelsFor(bg)) {
      for (const accent of colors) {
        const ink = accentInk(accent, bg, panel);
        const I = parseHex(ink);
        const ctx = `acento ${accent} fondo ${bg} panel ${panel} → ${ink}`;
        const surfaces = inkSurfaces(accent, bg, panel);
        const B = parseHex(bg);
        const pole = contrastRatio([0, 0, 0], B) >= contrastRatio([255, 255, 255], B) ? [0, 0, 0] : [255, 255, 255];
        if (!surfaces.every((s) => contrastRatio(pole, s) >= TEXT_AA)) {
          // Fondo de tono medio: ni el negro ni el blanco llegan. Lo mejor posible es el extremo.
          assert.deepEqual(I, pole, `inalcanzable, debería ser el extremo: ${ctx}`);
          continue;
        }
        assert.ok(surfaces.every((s) => contrastRatio(I, s) >= TEXT_AA), `tinta sin AA: ${ctx}`);
        if (ink === accent) continue;
        changed++;
        // Mínimo: el acento sin tocar no llegaba.
        assert.ok(!surfaces.every((s) => contrastRatio(parseHex(accent), s) >= TEXT_AA), `cambió sin necesidad: ${ctx}`);
        // Mismo tono (mezclar con negro o blanco no gira el matiz). Los grises no tienen tono.
        const h0 = hue(parseHex(accent)), h1 = hue(I);
        if (h0 !== null && h1 !== null) {
          const diff = Math.min(Math.abs(h0 - h1), 360 - Math.abs(h0 - h1));
          assert.ok(diff <= 4, `cambió el tono (${h0.toFixed(0)}° → ${h1.toFixed(0)}°): ${ctx}`);
        }
      }
    }
  }
  assert.ok(changed > 1000, `pocos acentos corregidos: ${changed}`);
});

const ACCENTS = [
  // [nombre, acento, fondo, panel]
  ['negro', '#000000', '#ffffff', '#f5f5f5'],
  ['verde por defecto', '#16a34a', '#ffffff', '#f5f5f5'],
  ['amarillo', '#facc15', '#ffffff', '#f5f5f5'],
  ['naranja', '#f97316', '#ffffff', '#f5f5f5'],
  ['rosa', '#ec4899', '#ffffff', '#f5f5f5'],
  ['crema', '#b45309', '#f7f3ec', '#ece6dc'],
  ['oscuro, acento negro', '#000000', '#111111', '#1c1c1c'],
  ['oscuro, acento violeta', '#7c3aed', '#0b0b14', '#16162a'],
];
for (const [name, accent, bg, panel] of ACCENTS) {
  test(`acento de referencia: ${name}`, () => {
    const ink = accentInk(accent, bg, panel);
    for (const s of inkSurfaces(accent, bg, panel)) assert.ok(contrastRatio(parseHex(ink), s) >= TEXT_AA, `${name}: ${ink}`);
    if (name === 'negro') assert.equal(ink, accent);
  });
}

// 4c. Rellenos con texto encima (C2) ------------------------------------------
test('relleno: lo que ya cumple no cambia; referencias', () => {
  assert.deepEqual(readableFill('#000000', '#ffffff'), { fill: '#000000', text: '#ffffff' });
  assert.deepEqual(readableFill('#2563EB', '#ffffff'), { fill: '#2563EB', text: '#ffffff' });
  assert.deepEqual(readableFill('#facc15'), { fill: '#facc15', text: '#111111' });
  assert.deepEqual(readableFill('var(--x)', '#ffffff'), { fill: 'var(--x)', text: '#ffffff' });
  // Verde por defecto y "Últimas unidades": mismo color, apenas más profundo, texto blanco.
  for (const c of ['#16a34a', '#EF4444', '#ff0000', '#ec4899']) {
    const r = readableFill(c, '#ffffff');
    assert.equal(r.text, '#ffffff', c);
    assert.notEqual(r.fill, c, c);
    assert.ok(contrastRatio(parseHex(r.text), parseHex(r.fill)) >= TEXT_AA, c);
  }
  // Naranja: oscurecerlo un 24 % dejaría de ser su naranja → se cambia el texto.
  const o = readableFill('#f97316', '#ffffff');
  assert.equal(o.fill, '#f97316');
  assert.equal(o.text, '#000000');
});

test('barrido de rellenos: siempre AA, ajuste ≤ 20 % y mínimo, o texto cambiado con el relleno intacto', () => {
  for (const fill of colors) {
    const F = parseHex(fill);
    for (const wanted of ['#ffffff', '#111111', undefined]) {
      const r = readableFill(fill, wanted);
      const ctx = `relleno ${fill} texto ${wanted} → ${JSON.stringify(r)}`;
      const R = parseHex(r.fill), T = parseHex(r.text);
      assert.ok(contrastRatio(T, R) >= TEXT_AA, `sin AA: ${ctx}`);
      const keep = wanted ?? (((0.299 * F[0] + 0.587 * F[1] + 0.114 * F[2]) / 255) > 0.6 ? '#111111' : '#ffffff');
      if (r.text === keep && r.fill === fill) continue;
      if (r.text === keep) {
        // Se movió el relleno: hacia el extremo opuesto al texto, ≤ 20 %, y mínimo.
        const pole = keep === '#ffffff' ? 0 : 255;
        const shares = [0, 1, 2].filter((i) => F[i] !== pole).map((i) => (F[i] - R[i]) / (F[i] - pole));
        assert.ok(shares.every((t) => t >= -0.01 && t <= 0.21), `corrimiento fuera de tope: ${ctx}`);
        assert.ok(contrastRatio(parseHex(keep), F) < TEXT_AA, `cambió sin necesidad: ${ctx}`);
      } else {
        // Se cambió el texto: el relleno queda tal cual.
        assert.equal(r.fill, fill, `cambió texto y relleno: ${ctx}`);
        assert.ok(r.text === '#ffffff' || r.text === '#000000', ctx);
      }
    }
  }
});

test('glass sobre foto: opacidad ≥ 85 % y AA contra el peor píxel', () => {
  for (const fill of colors) {
    for (const text of ['#ffffff', '#111111']) {
      const a = glassAlpha(fill, text);
      assert.ok(a >= 0.85 && a <= 1, `${fill} ${text} → ${a}`);
      const worst = relativeLuminance(parseHex(text)) > 0.5 ? [255, 255, 255] : [0, 0, 0];
      const seen = blend(parseHex(fill), worst, a).map(Math.round);
      // Si ni sólido alcanza, el ajuste del relleno (readableFill) es el que lo resuelve.
      if (a < 1) assert.ok(contrastRatio(parseHex(text), seen) >= TEXT_AA, `${fill} ${text} → ${a}`);
    }
  }
});

test('barra de beneficios: texto AA sobre su fondo real, mínimo cambio, mismo tono', () => {
  // Lo que ya cumple sale tal cual (v2 no cambia la barra de una tienda clara).
  assert.deepEqual(readableText('#111111', '#ffffff', 0.8), { text: '#111111', alpha: 0.8 });
  // Tema oscuro sin color propio: el texto del tema ya cumple.
  assert.equal(readableText('#f5f5f5', '#111111', 0.8).text, '#f5f5f5');
  // No es hex: intacto.
  assert.deepEqual(readableText('var(--x)', '#111111', 0.8), { text: 'var(--x)', alpha: 0.8 });
  const hexes = ['#000000', '#ffffff', '#777777', '#ff0000', '#16a34a', '#f97316', '#facc15', '#2563eb', '#ec4899', '#111111', '#f7f3ec', '#0b0b14', '#999999', '#5a5a5a'];
  for (const text of hexes) for (const bg of hexes) {
    const r = readableText(text, bg, 0.8);
    const ink = parseHex(r.text), b = parseHex(bg);
    assert.ok(alphaContrast(ink, b, r.alpha) >= TEXT_AA, text + ' sobre ' + bg);
    assert.ok(r.alpha >= 0.8);
    // Mínimo: un paso menos ya no alcanzaría (si hubo cambio de color).
    if (r.text !== text && r.alpha === 0.8) {
      const pole = contrastRatio([0, 0, 0], b) >= contrastRatio([255, 255, 255], b) ? [0, 0, 0] : [255, 255, 255];
      const t0 = parseHex(text);
      let k = 0; while (k <= 100 && blend(pole, t0, k / 100).map(Math.round).join() !== ink.join()) k++;
      if (k > 0 && k <= 100) assert.ok(alphaContrast(blend(pole, t0, (k - 1) / 100).map(Math.round), b, 0.8) < TEXT_AA, 'no mínimo ' + text + '/' + bg);
    }
  }
});

test('colores de estado: tinta AA en fondos claros, crema y oscuros', () => {
  for (const [bg, panel] of [['#ffffff', '#f5f5f5'], ['#f7f3ec', '#ece6dc'], ['#111111', '#1c1c1c'], ['#0b0b14', '#16162a']]) {
    for (const base of Object.values(STATUS_BASE)) {
      const ink = accentInk(base, bg, panel);
      for (const s of inkSurfaces(base, bg, panel)) assert.ok(contrastRatio(parseHex(ink), s) >= TEXT_AA, `${base} sobre ${bg}: ${ink}`);
    }
  }
});

// 5. CSS y applyTheme ---------------------------------------------------------
test('CSS: grises AA sólo bajo v2 y dentro de [data-ink], con vars que setea applyTheme', () => {
  const css = read('../src/styles/globals.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const theme = read('../src/lib/theme.ts');
  const blocks = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)];
  const usesAa = blocks.filter(([, , body]) => /var\(--(color-[a-z-]+-(aa|ink|fill)|on-primary-min-alpha)[,)]/.test(body));
  assert.ok(usesAa.length >= 1, 'no hay bloque de grises AA');
  for (const [, selector, body] of usesAa) {
    for (const sel of selector.split(',')) {
      assert.match(sel.trim(), /^:root\[data-typography='v2'\] \[data-ink='v2'\]/, `selector fuera del candado: ${sel.trim()}`);
    }
    for (const [, v] of body.matchAll(/var\((--[a-z-]+-(?:aa|ink|fill|min-alpha))[,)]/g)) {
      assert.ok(theme.includes(`'${v}'`), `applyTheme no setea ${v}`);
    }
  }
  // Nadie más redefine los grises en v2 (ej. un :root[data-typography='v2'] suelto
  // que llegaría al carrito o al checkout).
  for (const [, selector, body] of blocks) {
    if (/--color-(on-surface-)?(muted|subtle)\s*:/.test(body) && selector.includes("data-typography='v2'")) {
      assert.match(selector, /\[data-ink='v2'\]/, `grises redefinidos fuera del ámbito: ${selector.trim()}`);
    }
  }
});

// 6. Ámbito -------------------------------------------------------------------
test('ContrastScope: Fragment en v1 y sólo en las rutas del alcance', () => {
  const scope = read('../src/components/ContrastScope.tsx');
  assert.match(scope, /if \(version !== 'v2'\) return <>\{children\}<\/>;/);
  const app = read('../src/App.tsx');
  const wrapped = [...app.matchAll(/<Route path="([^"]+)" element=\{<ContrastScope>/g)].map((m) => m[1]).sort();
  assert.deepEqual(wrapped, ['/', '/categoria/:name', '/categorias', '/producto/:id', '/productos']);
  for (const out of ['carrito', 'checkout', 'resena', 'pagina']) {
    assert.ok(!new RegExp(`path="/${out}[^"]*" element=\\{<ContrastScope>`).test(app), `${out} no debe estar en el ámbito`);
  }
  // El carrito lateral, navbar y footer viven en el Layout, fuera de <Routes>.
  const layout = read('../src/components/Layout.tsx');
  assert.ok(!layout.includes('ContrastScope') && !layout.includes('data-ink'));
});

console.log(`✓ contraste: ${passed} pruebas`);
