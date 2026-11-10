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
