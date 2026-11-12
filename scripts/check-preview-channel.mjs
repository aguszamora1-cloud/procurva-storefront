// EDITOR E2.0a · pruebas del canal de la vista previa (src/lib/previewChannel.ts).
//
//   npm run test:preview-channel
//
// Corre con Node >= 22.18 (le saca los tipos al .ts). No está en `check` por la
// misma razón que test:typography.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPreviewChannel,
  parseInbound,
  PREVIEW_NS,
  MAX_MESSAGE_BYTES,
} from '../src/lib/previewChannel.ts';
import { classifyFrame } from '../src/lib/designerFrame.ts';

const ERP = 'https://procurva.app';
const CH = 'a'.repeat(32);
const CH2 = 'b'.repeat(32);
const ID = { companyId: '11111111-2222-4333-8444-555555555555', storeKey: 'retail', slug: 'tienda-sim' };

/** Ventana simulada: `parent` registra lo que la tienda le manda. */
function fakeWindow({ framed = true } = {}) {
  const listeners = new Set();
  const sent = [];
  const win = {
    addEventListener: (t, fn) => t === 'message' && listeners.add(fn),
    removeEventListener: (t, fn) => t === 'message' && listeners.delete(fn),
    listeners,
    sent,
  };
  win.parent = framed ? { postMessage: (msg, origin) => sent.push({ msg, origin }) } : win;
  win.emit = (data, { origin = ERP, source = win.parent } = {}) =>
    [...listeners].forEach((fn) => fn({ data, origin, source }));
  return win;
}

const hello = (channel = CH, expect = ID) => ({ ns: PREVIEW_NS, v: 1, type: 'hello', channel, expect });
const mk = (win, extra = {}) =>
  createPreviewChannel({ win, marked: true, origins: [ERP], timeoutMs: 50, ...extra });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('visita normal (no enmarcada): público, sin listeners ni mensajes', () => {
  const win = fakeWindow({ framed: false });
  const ch = mk(win);
  ch.start();
  assert.equal(ch.state, 'public');
  assert.equal(win.listeners.size, 0);
  assert.equal(win.sent.length, 0);
});

test('enmarcada SIN marca de vista previa: público, sin listeners ni mensajes', () => {
  const win = fakeWindow();
  const ch = mk(win, { marked: false });
  ch.start();
  assert.equal(ch.state, 'public');
  assert.equal(win.listeners.size, 0);
  assert.equal(win.sent.length, 0);
});

test('con marca y enmarcada: probe sólo a orígenes exactos (nunca *), y pending', () => {
  const win = fakeWindow();
  const ch = mk(win, { origins: [ERP, 'http://localhost:5314'] });
  ch.start();
  assert.equal(ch.state, 'pending');
  assert.deepEqual(win.sent.map((s) => s.origin), [ERP, 'http://localhost:5314']);
  assert.ok(win.sent.every((s) => s.origin !== '*' && s.msg.type === 'probe' && /^[0-9a-f]{32}$/.test(s.msg.doc)));
  ch.stop();
});

test('hello válido del padre y del origen exacto: preview + ready con la identidad', () => {
  const win = fakeWindow();
  const ch = mk(win);
  ch.start();
  ch.setIdentity(ID);
  win.emit(hello());
  assert.equal(ch.state, 'preview');
  const ready = win.sent.find((s) => s.msg.type === 'ready');
  assert.equal(ready.origin, ERP);
  assert.deepEqual(ready.msg, { ns: PREVIEW_NS, v: 1, type: 'ready', channel: CH, doc: ch.doc, store: ID });
  ch.stop();
});

test('E2.0c: ready apenas llega el hello (store null) y otra vez al resolver la identidad', () => {
  const win = fakeWindow();
  const ch = mk(win);
  ch.start();
  win.emit(hello());
  const r1 = win.sent.filter((s) => s.msg.type === 'ready');
  assert.equal(r1.length, 1);
  assert.equal(r1[0].msg.store, null);
  ch.setIdentity(null); // sin cambios: no repite
  assert.equal(win.sent.filter((s) => s.msg.type === 'ready').length, 1);
  ch.setIdentity(ID);
  const r2 = win.sent.filter((s) => s.msg.type === 'ready');
  assert.equal(r2.length, 2);
  assert.deepEqual(r2[1].msg.store, ID);
  ch.stop();
});

test('orígenes y fuentes falsas: se ignoran', () => {
  const win = fakeWindow();
  const ch = mk(win);
  ch.start();
  win.emit(hello(), { origin: 'https://evil.example' });
  win.emit(hello(), { origin: 'https://procurva.app.evil.example' });
  win.emit(hello(), { origin: 'http://procurva.app' });
  win.emit(hello(), { origin: 'https://www.procurva.app' });
  win.emit(hello(), { origin: 'https://tienda.procurva.app' });
  win.emit(hello(), { source: {} }); // otro frame con el origen correcto
  win.emit(hello(), { source: win }); // la propia tienda
  assert.equal(ch.state, 'pending');
  ch.stop();
});

test('mensajes malformados: se ignoran', () => {
  const bad = [
    null, 'hello', 42, [], { ...hello(), ns: 'otro' }, { ...hello(), v: 2 }, { ...hello(), type: 'HELLO' },
    { ...hello(), channel: 'corto' }, { ...hello(), channel: 'A'.repeat(32) }, { ...hello(), extra: 1 },
    { ns: PREVIEW_NS, v: 1, type: 'hello', channel: CH }, hello(CH, { ...ID, companyId: 'x' }),
    hello(CH, { ...ID, storeKey: '../x' }), hello(CH, { ...ID, extra: true }),
    { ns: PREVIEW_NS, v: 1, type: 'draft', channel: CH, config: {} },
    { ns: PREVIEW_NS, v: 1, type: 'hello', channel: CH, expect: { ...ID, slug: 'x'.repeat(MAX_MESSAGE_BYTES) } },
  ];
  for (const b of bad) assert.equal(parseInbound(b), null, JSON.stringify(b)?.slice(0, 80));
  const proto = Object.create({ polluted: true });
  Object.assign(proto, hello());
  assert.equal(parseInbound(proto), null, 'objeto con prototipo raro');
  const win = fakeWindow();
  const ch = mk(win);
  ch.start();
  for (const b of bad) win.emit(b);
  assert.equal(ch.state, 'pending');
  ch.stop();
});

test('sin hello en el plazo: pasa a público (no se bloquea nada)', async () => {
  const win = fakeWindow();
  const ch = mk(win);
  ch.start();
  assert.equal(await ch.settled(), 'public');
  ch.stop();
});

test('hello tardío (después del plazo): igual pasa a vista previa', async () => {
  const win = fakeWindow();
  const ch = mk(win);
  ch.start();
  await wait(70);
  assert.equal(ch.state, 'public');
  win.emit(hello());
  assert.equal(ch.state, 'preview');
  ch.stop();
});

test('settled espera el hello si llega antes del plazo', async () => {
  const win = fakeWindow();
  const ch = mk(win, { timeoutMs: 1000 });
  ch.start();
  const p = ch.settled();
  setTimeout(() => win.emit(hello()), 10);
  assert.equal(await p, 'preview');
  ch.stop();
});

test('duplicados: hello repetido no repite el ready; canal nuevo sí', () => {
  const win = fakeWindow();
  const ch = mk(win);
  ch.start();
  ch.setIdentity(ID);
  win.emit(hello());
  win.emit(hello());
  win.emit(hello());
  assert.equal(win.sent.filter((s) => s.msg.type === 'ready').length, 1);
  win.emit(hello(CH2));
  const readies = win.sent.filter((s) => s.msg.type === 'ready');
  assert.equal(readies.length, 2);
  assert.equal(readies[1].msg.channel, CH2);
  ch.stop();
});

test('ack: sólo el del canal vigente y para este documento', () => {
  const win = fakeWindow();
  const ch = mk(win);
  ch.start();
  ch.setIdentity(ID);
  win.emit(hello());
  win.emit({ ns: PREVIEW_NS, v: 1, type: 'ack', channel: CH2, doc: ch.doc });
  win.emit({ ns: PREVIEW_NS, v: 1, type: 'ack', channel: CH, doc: 'c'.repeat(32) });
  win.emit({ ns: PREVIEW_NS, v: 1, type: 'ack', channel: CH, doc: ch.doc }, { origin: 'https://evil.example' });
  assert.equal(ch.acked, false);
  win.emit({ ns: PREVIEW_NS, v: 1, type: 'ack', channel: CH, doc: ch.doc });
  assert.equal(ch.acked, true);
  ch.stop();
});

test('stop: quita el listener (desmontaje / descarga)', () => {
  const win = fakeWindow();
  const ch = mk(win);
  ch.start();
  assert.equal(win.listeners.size, 1);
  ch.stop();
  assert.equal(win.listeners.size, 0);
});

test('cada documento tiene su propio doc (recarga = documento nuevo)', () => {
  const a = mk(fakeWindow());
  const b = mk(fakeWindow());
  assert.notEqual(a.doc, b.doc);
});

test('producción: sólo https://procurva.app, sin importar el entorno', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/lib/previewChannel.ts', import.meta.url), 'utf8');
  assert.match(src, /PROD_PARENT_ORIGINS: readonly string\[\] = \['https:\/\/procurva\.app'\]/);
  assert.match(src, /import\.meta\.env\.MODE === 'production'\s*\?\s*\[\]/);
  assert.doesNotMatch(src, /postMessage\([^)]*['"]\*['"]/);
});

// ---- E2.0c · quién enmarca la tienda (señales del navegador, no de la URL) ----
const ERPS = ['https://procurva.app'];
const sig = (o) => ({ framed: true, ancestorOrigins: null, referrer: '', marked: false, erpOrigins: ERPS, ...o });

test('E2.0c: pestaña normal (con o sin pc_preview) = top, nunca diseñador', () => {
  assert.equal(classifyFrame(sig({ framed: false, ancestorOrigins: ['https://procurva.app'], marked: true, referrer: 'https://procurva.app/' })), 'top');
});

test('E2.0c: ancestorOrigins manda (Chromium/Safari)', () => {
  assert.equal(classifyFrame(sig({ ancestorOrigins: ['https://procurva.app'] })), 'designer');
  assert.equal(classifyFrame(sig({ ancestorOrigins: ['https://evil.example'], marked: true, referrer: 'https://procurva.app/' })), 'other');
  assert.equal(classifyFrame(sig({ ancestorOrigins: ['https://www.procurva.app'] })), 'other');
  assert.equal(classifyFrame(sig({ ancestorOrigins: ['https://procurva.app.evil.example'] })), 'other');
  assert.equal(classifyFrame(sig({ ancestorOrigins: ['http://procurva.app'] })), 'other');
  assert.equal(classifyFrame(sig({ ancestorOrigins: ['https://tienda.procurva.app', 'https://procurva.app'] })), 'other', 'sólo el padre directo');
});

test('E2.0c: sin ancestorOrigins (Firefox): referrer del documento inicial y marca del marco', () => {
  assert.equal(classifyFrame(sig({ referrer: 'https://procurva.app/' })), 'designer');
  assert.equal(classifyFrame(sig({ referrer: 'https://evil.example/pagina' })), 'other');
  assert.equal(classifyFrame(sig({ referrer: 'https://tienda.procurva.app/checkout', marked: true })), 'designer', 'navegación dentro del marco del diseñador');
  assert.equal(classifyFrame(sig({ referrer: 'https://tienda.procurva.app/checkout' })), 'other');
  assert.equal(classifyFrame(sig({ referrer: '' })), 'unknown', 'referrer suprimido: no se adivina');
  assert.equal(classifyFrame(sig({ ancestorOrigins: ['null'], referrer: '' })), 'unknown');
  assert.equal(classifyFrame(sig({ referrer: 'no es url' })), 'unknown');
});

test('E2.0c: pc_preview no participa de la detección', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/lib/designerFrame.ts', import.meta.url), 'utf8');
  // Fuera de los comentarios (que explican por qué NO se usa).
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(codigo, /pc_preview|isPreviewMode/);
});

// ───────── EDITOR E3.0 · selección visual: inspect / reveal / select ─────────

const ack = (channel, doc) => ({ ns: PREVIEW_NS, v: 1, type: 'ack', channel, doc });
const inspect = (channel, doc, on = true) => ({ ns: PREVIEW_NS, v: 1, type: 'inspect', channel, doc, on });
const reveal = (channel, doc, section) => ({ ns: PREVIEW_NS, v: 1, type: 'reveal', channel, doc, section });
const UUIDK = 'custom:11111111-2222-4333-8444-555555555555';

/** Canal con handshake completo (hello + ready + ack) y registro de eventos de selección. */
function conectado({ conAck = true } = {}) {
  const win = fakeWindow();
  const ch = mk(win);
  ch.start();
  ch.setIdentity(ID);
  win.emit(hello());
  if (conAck) win.emit(ack(CH, ch.doc));
  const eventos = [];
  ch.onInspect((e) => eventos.push(e));
  return { win, ch, eventos };
}

test('E3.0 parseo: inspect y reveal válidos', () => {
  const D = 'd'.repeat(32);
  assert.deepEqual(parseInbound(inspect(CH, D, true)), { type: 'inspect', channel: CH, doc: D, on: true });
  assert.deepEqual(parseInbound(inspect(CH, D, false)), { type: 'inspect', channel: CH, doc: D, on: false });
  assert.deepEqual(parseInbound(reveal(CH, D, 'featured')), { type: 'reveal', channel: CH, doc: D, section: 'featured' });
  assert.deepEqual(parseInbound(reveal(CH, D, null)), { type: 'reveal', channel: CH, doc: D, section: null });
  assert.deepEqual(parseInbound(reveal(CH, D, UUIDK)), { type: 'reveal', channel: CH, doc: D, section: UUIDK });
});

test('E3.0 parseo: mensajes inválidos se descartan', () => {
  const D = 'd'.repeat(32);
  const malos = [
    { ...inspect(CH, D), extra: 1 },
    { ...inspect(CH, D), on: 'true' },
    { ...inspect(CH, D), on: 1 },
    { ns: PREVIEW_NS, v: 1, type: 'inspect', channel: CH, doc: D },
    { ...inspect(CH, D), v: 2 },
    { ...inspect(CH, D), ns: 'otro' },
    { ...inspect('x'.repeat(32), D) },
    { ...inspect(CH, 'corto') },
    { ...reveal(CH, D, 'featured'), extra: 1 },
    reveal(CH, D, 'Featured'),
    reveal(CH, D, 'feat ured'),
    reveal(CH, D, 'a'.repeat(33)),
    reveal(CH, D, 'custom:no-uuid'),
    reveal(CH, D, '[data-x]'),
    reveal(CH, D, 'hero"]'),
    reveal(CH, D, 7),
    reveal(CH, D, { k: 'hero' }),
    { ns: PREVIEW_NS, v: 1, type: 'reveal', channel: CH, doc: D },
    { ns: PREVIEW_NS, v: 1, type: 'select', channel: CH, doc: D, page: 'home', section: 'hero' }, // eco: la tienda no acepta su propio select
    { ns: PREVIEW_NS, v: 1, type: 'config', channel: CH, doc: D, settings: {} },
    { ...reveal(CH, D, 'hero'), section: 'h'.repeat(3000) },
  ];
  for (const m of malos) assert.equal(parseInbound(m), null, JSON.stringify(m).slice(0, 100));
});

test('E3.0 inspect con handshake completo: activa, y select sale sólo al origen exacto', () => {
  const { win, ch, eventos } = conectado();
  win.emit(inspect(CH, ch.doc, true));
  assert.equal(ch.inspecting, true);
  assert.deepEqual(eventos, [{ type: 'inspect', on: true }]);
  const antes = win.sent.length;
  assert.equal(ch.select('featured', 'home'), true);
  const sel = win.sent.slice(antes);
  assert.equal(sel.length, 1);
  assert.equal(sel[0].origin, ERP);
  assert.deepEqual(sel[0].msg, { ns: PREVIEW_NS, v: 1, type: 'select', channel: CH, doc: ch.doc, page: 'home', section: 'featured' });
  assert.ok(win.sent.every((s) => s.origin !== '*'));
});

test('E3.0 sin ack (ERP viejo o handshake incompleto): inspect se ignora y no hay select', () => {
  const { win, ch, eventos } = conectado({ conAck: false });
  win.emit(inspect(CH, ch.doc, true));
  assert.equal(ch.inspecting, false);
  assert.deepEqual(eventos, []);
  const antes = win.sent.length;
  assert.equal(ch.select('featured', 'home'), false);
  assert.equal(win.sent.length, antes);
});

test('E3.0 ERP viejo (hello + ack, nunca inspect): la selección nunca se activa', () => {
  const { ch, eventos } = conectado();
  assert.equal(ch.inspecting, false);
  assert.equal(ch.select('hero', 'home'), false);
  assert.deepEqual(eventos, []);
});

test('E3.0 inspect de otro canal, otro documento, otro origen o no del padre: se ignora', () => {
  const { win, ch, eventos } = conectado();
  win.emit(inspect(CH2, ch.doc, true));
  win.emit(inspect(CH, 'e'.repeat(32), true));
  win.emit(inspect(CH, ch.doc, true), { origin: 'https://evil.com' });
  win.emit(inspect(CH, ch.doc, true), { origin: 'http://localhost:5314' });
  win.emit(inspect(CH, ch.doc, true), { source: {} });
  assert.equal(ch.inspecting, false);
  assert.deepEqual(eventos, []);
});

test('E3.0 reveal: sólo con la selección activa, canal y documento vigentes', () => {
  const { win, ch, eventos } = conectado();
  win.emit(reveal(CH, ch.doc, 'featured')); // todavía apagada
  assert.deepEqual(eventos, []);
  win.emit(inspect(CH, ch.doc, true));
  win.emit(reveal(CH, ch.doc, 'featured'));
  win.emit(reveal(CH2, ch.doc, 'hero'));
  win.emit(reveal(CH, 'e'.repeat(32), 'hero'));
  win.emit(reveal(CH, ch.doc, null));
  assert.deepEqual(eventos, [
    { type: 'inspect', on: true },
    { type: 'reveal', section: 'featured' },
    { type: 'reveal', section: null },
  ]);
});

test('E3.0 desconexión: un hello de canal nuevo apaga la selección en el acto', () => {
  const { win, ch, eventos } = conectado();
  win.emit(inspect(CH, ch.doc, true));
  win.emit(hello(CH2));
  assert.equal(ch.inspecting, false);
  assert.equal(ch.acked, false);
  assert.deepEqual(eventos.at(-1), { type: 'inspect', on: false });
  // El inspect del canal viejo ya no vale; el del nuevo exige su propio ack.
  win.emit(inspect(CH, ch.doc, true));
  win.emit(inspect(CH2, ch.doc, true));
  assert.equal(ch.inspecting, false);
  assert.equal(ch.select('hero', 'home'), false);
  win.emit(ack(CH2, ch.doc));
  win.emit(inspect(CH2, ch.doc, true));
  assert.equal(ch.inspecting, true);
  const antes = win.sent.length;
  ch.select('hero', 'home');
  assert.equal(win.sent.slice(antes)[0].msg.channel, CH2);
});

test('E3.0 inspect off, repetidos y stop(): apaga una sola vez y no manda select', () => {
  const { win, ch, eventos } = conectado();
  win.emit(inspect(CH, ch.doc, true));
  win.emit(inspect(CH, ch.doc, true)); // repetido
  win.emit(inspect(CH, ch.doc, false));
  win.emit(inspect(CH, ch.doc, false)); // repetido
  assert.deepEqual(eventos, [{ type: 'inspect', on: true }, { type: 'inspect', on: false }]);
  assert.equal(ch.select('hero', 'home'), false);
  win.emit(inspect(CH, ch.doc, true));
  ch.stop();
  assert.equal(ch.inspecting, false);
  assert.deepEqual(eventos.at(-1), { type: 'inspect', on: false });
});

test('E3.0 select: sólo claves de sección y páginas válidas', () => {
  const { win, ch } = conectado();
  win.emit(inspect(CH, ch.doc, true));
  const antes = win.sent.length;
  for (const [s, p] of [['Hero', 'home'], ['hero', 'inicio'], ['hero"]', 'home'], ['', 'home'], [null, 'home'], ['a'.repeat(40), 'home']]) {
    assert.equal(ch.select(s, p), false, `${s} ${p}`);
  }
  assert.equal(win.sent.length, antes);
  assert.equal(ch.select(UUIDK, 'home'), true);
});

test('E3.0 visita pública: la selección no existe (ni listeners ni select)', () => {
  const win = fakeWindow({ framed: false });
  const ch = mk(win);
  ch.start();
  assert.equal(ch.inspecting, false);
  assert.equal(ch.select('hero', 'home'), false);
  assert.equal(win.listeners.size, 0);
  assert.equal(win.sent.length, 0);
});

test('E3.0 previewInspect: secciones seleccionables, páginas y etiquetas', async () => {
  const m = await import('../src/lib/previewInspect.ts');
  assert.deepEqual([...m.SELECTABLE_SECTIONS].sort(), ['categories', 'featured', 'hero', 'new_arrivals', 'offers', 'trust_badges']);
  for (const k of m.SELECTABLE_SECTIONS) assert.ok(m.SECTION_LABELS[k], k);
  for (const k of ['newsletter', 'outfits', 'social_proof', 'reels', 'stories', UUIDK, 'checkout', '', null, undefined]) {
    assert.equal(m.isSelectableSection(k), false, String(k));
  }
  assert.equal(m.pageOf('/'), 'home');
  assert.equal(m.pageOf('/producto/abc'), 'producto');
  assert.equal(m.pageOf('/checkout'), 'checkout');
  assert.equal(m.pageOf('/categoria/remeras'), 'other');
  assert.equal(m.pageOf('/productos'), 'other');
  // La capa no hace nada en una visita pública (sin canal o canal público).
  m.initPreviewInspect(null);
  m.initPreviewInspect({ state: 'public', onInspect: () => assert.fail('no debería suscribirse') });
});

test('E3.1.1 etiquetas permanentes: sólo las 5 secciones de E3.1 (sin Distintivos de confianza)', async () => {
  const m = await import('../src/lib/previewInspect.ts');
  assert.deepEqual([...m.LABELED_SECTIONS], ['hero', 'categories', 'featured', 'new_arrivals', 'offers']);
  assert.equal(m.LABELED_SECTIONS.includes('trust_badges'), false);
  for (const k of m.LABELED_SECTIONS) {
    assert.ok(m.isSelectableSection(k), k);
    assert.ok(m.SECTION_LABELS[k], k);
  }
  // Distintivos de confianza conserva su hover de E3.0 (sigue seleccionable en la tienda).
  assert.equal(m.isSelectableSection('trust_badges'), true);
});

test('E3.1.1 posición de la etiqueta: esquina de la parte visible, debajo del encabezado y dentro de la ventana', async () => {
  const m = await import('../src/lib/previewInspect.ts');
  const box = (left, top, right, bottom) => ({ left, top, right, bottom });
  // Sección entera visible: esquina + 8 px.
  assert.deepEqual(m.tagPosition(box(0, 200, 1200, 600), 60, 1200, 800), { x: 8, y: 208 });
  // Borde superior detrás del encabezado fijo (60 px): baja a la parte visible.
  assert.deepEqual(m.tagPosition(box(0, -300, 1200, 400), 60, 1200, 800), { x: 8, y: 68 });
  // Carrusel con diapositivas fuera de pantalla a la izquierda: la etiqueta no se va afuera.
  assert.deepEqual(m.tagPosition(box(-2400, 100, 3600, 500), 0, 1200, 800), { x: 8, y: 108 });
  // Fuera de la ventana (arriba, abajo o tapada por el encabezado): no se dibuja.
  assert.equal(m.tagPosition(box(0, -500, 1200, -10), 60, 1200, 800), null);
  assert.equal(m.tagPosition(box(0, 900, 1200, 1300), 60, 1200, 800), null);
  assert.equal(m.tagPosition(box(0, -500, 1200, 70), 60, 1200, 800), null); // sólo 10 px visibles
  // Sección vacía o sin geometría: no se dibuja.
  assert.equal(m.tagPosition(null, 0, 1200, 800), null);
  assert.equal(m.tagPosition(box(0, 100, 40, 500), 0, 1200, 800), null); // demasiado angosta
  // Celular (390 px): misma regla.
  assert.deepEqual(m.tagPosition(box(0, 120, 390, 700), 56, 390, 844), { x: 8, y: 128 });
});

test('E3.2 B1 destino del reveal: 8 px debajo del encabezado, dentro de lo que la página permite', async () => {
  const m = await import('../src/lib/previewInspect.ts');
  assert.equal(m.REVEAL_INSET, 8);
  // Sección a 1600 px del documento, encabezado de 61 px: 1600 - 61 - 8.
  assert.equal(m.revealTarget(1600, 61, 5000), 1531);
  // Arriba de todo (Banner principal debajo del encabezado): nunca negativo.
  assert.equal(m.revealTarget(61, 61, 5000), 0);
  // Cerca del pie: la página no baja más que su máximo.
  assert.equal(m.revealTarget(4800, 61, 4200), 4200);
  // Página que no se desplaza.
  assert.equal(m.revealTarget(300, 0, -20), 0);
  // Redondeo a px enteros.
  assert.equal(m.revealTarget(1600.6, 61.2, 5000), 1531);
});

test('E3.2 B1 plan del reveal: no desplaza si ya está en su lugar o en la franja de arriba', async () => {
  const m = await import('../src/lib/previewInspect.ts');
  const base = { clipTop: 61, viewH: 800, maxScroll: 5000 };
  // Fuera de pantalla (abajo): va al destino.
  assert.equal(m.revealPlan({ ...base, docTop: 1600, scrollY: 0 }), 1531);
  // Fuera de pantalla (arriba, ya pasada): vuelve.
  assert.equal(m.revealPlan({ ...base, docTop: 600, scrollY: 2000 }), 531);
  // Ya en su lugar (±2 px): nada.
  assert.equal(m.revealPlan({ ...base, docTop: 1600, scrollY: 1530 }), null);
  // Banner principal con la página arriba: nada.
  assert.equal(m.revealPlan({ ...base, docTop: 61, scrollY: 0 }), null);
  // Borde superior visible en la franja de arriba (35 % de 739 px ≈ 258 px bajo el encabezado): nada.
  assert.equal(m.revealPlan({ ...base, docTop: 1600, scrollY: 1400 }), null); // queda a 200 px
  // Visible pero más abajo de la franja: se acomoda.
  assert.equal(m.revealPlan({ ...base, docTop: 1600, scrollY: 1100 }), 1531); // a 500 px
  // Borde superior escondido detrás del encabezado: se acomoda aunque se vea el resto.
  assert.equal(m.revealPlan({ ...base, docTop: 1600, scrollY: 1580 }), 1531);
  // Al fondo: la página no puede acercarla más, ya está todo lo arriba posible.
  assert.equal(m.revealPlan({ ...base, docTop: 4900, scrollY: 4200, maxScroll: 4200 }), null);
  // Franja mínima de 48 px en una ventana muy baja.
  assert.equal(m.revealPlan({ clipTop: 61, viewH: 150, maxScroll: 5000, docTop: 1600, scrollY: 1500 }), null); // a 39 px
  assert.equal(m.revealPlan({ clipTop: 61, viewH: 150, maxScroll: 5000, docTop: 1600, scrollY: 1480 }), 1531); // a 59 px
});
