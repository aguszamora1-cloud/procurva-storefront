// Prueba del iframe de Turnstile del probador (api/turnstile-frame.ts), F0.5.
// Uso: PW_DEPS=<carpeta con playwright instalado> node scripts/turnstile-frame.test.mjs
//   (playwright NO es dependencia de la tienda; por ejemplo el repo exterior de ProCurva).
// 1) Encabezados por caso (sin red: la RPC de dominio propio está simulada).
// 2) El HTML real en Chromium, Firefox y WebKit, con las claves de PRUEBA de
//    Turnstile. Como localmente no hay https, el origen del padre y frame-ancestors
//    se reescriben a http://localhost:8801; el script y la CSP son los reales.
import http from "node:http";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
if (!process.env.PW_DEPS) throw new Error("Falta PW_DEPS (carpeta con playwright instalado)");
const pw = createRequire(join(process.env.PW_DEPS, "package.json"))("playwright");
const FRAME_TS = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "..", "api", "turnstile-frame.ts")).href;

process.env.TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
process.env.SUPABASE_URL = "https://supa.test";
process.env.SUPABASE_ANON_KEY = "anon";
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://supa.test/rest/v1/rpc/get_storefront_by_custom_domain")) {
    const d = JSON.parse(init.body).p_domain;
    const map = { "tienda-rosario.com.ar": "rosario", "otra-tienda.com": "otra" };
    return new Response(JSON.stringify(map[d] ? { slug: map[d] } : null), { status: 200 });
  }
  return realFetch(url, init);
};
const { default: handler } = await import(FRAME_TS);

const call = async (host, parent, method = "GET") => {
  const out = { status: 0, headers: {}, body: "" };
  const res = {
    setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; },
    status: (s) => { out.status = s; return res; },
    send: (b) => { out.body = b; },
  };
  await handler({ method, headers: { host }, query: parent === undefined ? {} : { parent } }, res);
  return out;
};
const fa = (o) => (o.headers["content-security-policy"] || "").match(/frame-ancestors ([^;]+)/)?.[1];
let bien = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, `${name} ${extra}`); bien++; console.log(`BIEN  ${name}`); };

// ---------- 1) encabezados
let r = await call("rosario.procurva.app", "https://rosario.procurva.app");
ok("tienda en su subdominio: 200 y frame-ancestors 'self'", r.status === 200 && fa(r) === "'self'", fa(r));
r = await call("rosario.procurva.app", "https://tienda-rosario.com.ar");
ok("dominio propio verificado de ESA tienda: se permite sólo ese origen", r.status === 200 && fa(r) === "'self' https://tienda-rosario.com.ar", fa(r));
r = await call("rosario.procurva.app", "https://otra-tienda.com");
ok("dominio propio de OTRA tienda: 403 y frame-ancestors 'none'", r.status === 403 && fa(r) === "'none'");
r = await call("rosario.procurva.app", "https://evil.com");
ok("sitio cualquiera: 403", r.status === 403 && fa(r) === "'none'");
for (const p of ["http://tienda-rosario.com.ar", "https://tienda-rosario.com.ar/x", "https://u:p@tienda-rosario.com.ar", "https://tienda-rosario.com.ar:8443", "javascript:alert(1)"]) {
  r = await call("rosario.procurva.app", p);
  ok(`parent raro (${p}): se ignora y queda sólo 'self'`, r.status === 200 && fa(r) === "'self'", fa(r));
}
for (const h of ["www.procurva.app", "app.procurva.app", "procurva.app", "a.b.procurva.app", "evil.com", "rosario.procurva.app.evil.com"]) {
  r = await call(h, "https://tienda-rosario.com.ar");
  ok(`host ${h}: 404`, r.status === 404 && fa(r) === "'none'");
}
r = await call("rosario.procurva.app", undefined, "POST");
ok("POST: 405", r.status === 405);
r = await call("rosario.procurva.app", "https://tienda-rosario.com.ar");
ok("CSP del frame: scripts sólo con nonce + Cloudflare, sin inline libre", /script-src 'nonce-[A-Za-z0-9+/=]+' https:\/\/challenges\.cloudflare\.com/.test(r.headers["content-security-policy"]) && !/unsafe-inline'[^;]*script|script-src[^;]*unsafe-inline/.test(r.headers["content-security-policy"]));
ok("sin caché (nonce por respuesta)", r.headers["cache-control"] === "no-store");
ok("responde sólo al origen permitido (nunca a '*')", r.body.includes('var PARENT = "https://tienda-rosario.com.ar"') && !/postMessage\([^)]*['"]\*['"]/.test(r.body));
const inject = (await call("rosario.procurva.app", "https://tienda-rosario.com.ar")).body;
ok("el valor de parent no puede cerrar el <script>", !/<\/script><script>alert/.test(inject));
delete process.env.TURNSTILE_SITE_KEY;
const { default: h2 } = await import(FRAME_TS + "?sin-clave");
const o2 = { status: 0, headers: {}, body: "" };
await h2({ method: "GET", headers: { host: "rosario.procurva.app" }, query: {} }, { setHeader: (k, v) => { o2.headers[k] = v; }, status: (s) => { o2.status = s; return { send() {} }; }, send() {} });
ok("sin TURNSTILE_SITE_KEY: no sirve el frame (404)", o2.status === 404);
process.env.TURNSTILE_SITE_KEY = "1x00000000000000000000AA";

// ---------- 2) navegadores
const TIENDA = "http://localhost:8801", FRAME = "http://127.0.0.1:8802", ATACANTE = "http://127.0.0.2:8803";
const PRODUCT = "6f1c2b9e-3d4a-4b5c-8d7e-1f2a3b4c5d6e";
const real = await call("rosario.procurva.app", "https://tienda-rosario.com.ar");
const frameBody = real.body.replace('var PARENT = "https://tienda-rosario.com.ar"', `var PARENT = "${TIENDA}"`);
const frameCsp = real.headers["content-security-policy"].replace("'self' https://tienda-rosario.com.ar", TIENDA);
assert.ok(frameBody.includes(`var PARENT = "${TIENDA}"`) && frameCsp.includes(`frame-ancestors ${TIENDA}`));

// Página "tienda": misma lógica que src/lib/turnstileFrame.ts (requestTryonToken / isFromFrame).
const host = (src) => `<!doctype html><meta charset="utf-8"><body><iframe id="f" src="${src}" style="width:300px;height:80px;border:0"></iframe><script>
const f = document.getElementById("f");
window.pedir = (productId) => new Promise((resolve) => {
  const nonce = crypto.randomUUID();
  const on = (ev) => {
    if (ev.origin !== "${FRAME}" || ev.source !== f.contentWindow) return;
    const m = ev.data || {};
    if ((m.type === "tryon:token" || m.type === "tryon:token-error") && m.nonce === nonce) { removeEventListener("message", on); resolve(m); }
  };
  addEventListener("message", on);
  f.contentWindow.postMessage({ type: "tryon:token-request", productId, nonce }, "${FRAME}");
  setTimeout(() => resolve({ type: "sin-respuesta" }), 12000);
});
</script>`;
const serve = (port, h, fn) => new Promise((ok_) => http.createServer(fn).listen(port, h, ok_));
await serve(8801, "localhost", (q, s) => { s.setHeader("Content-Type", "text/html"); s.end(host(`${FRAME}/f`)); });
await serve(8802, "127.0.0.1", (q, s) => { s.setHeader("Content-Type", "text/html; charset=utf-8"); s.setHeader("Content-Security-Policy", frameCsp); s.end(frameBody); });
await serve(8803, "127.0.0.2", (q, s) => { s.setHeader("Content-Type", "text/html"); s.end(host(`${FRAME}/f`)); });

for (const name of ["chromium", "firefox", "webkit"]) {
  const b = await pw[name].launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });
  await p.goto(TIENDA); await p.waitForTimeout(3500);
  const a = await p.evaluate((id) => window.pedir(id), PRODUCT);
  const a2 = await p.evaluate((id) => window.pedir(id), PRODUCT);
  const bad = await p.evaluate(() => window.pedir("no-uuid"));
  const atk = await ctx.newPage();
  await atk.goto(ATACANTE); await atk.waitForTimeout(3500);
  const c = await atk.evaluate((id) => window.pedir(id), PRODUCT);
  await b.close();
  ok(`${name}: la tienda obtiene un token con el frame real`, a.type === "tryon:token" && a.token.length > 10, JSON.stringify(a) + errs.join(" | "));
  ok(`${name}: segundo pedido = token nuevo`, a2.type === "tryon:token");
  ok(`${name}: producto inválido se ignora`, bad.type === "sin-respuesta");
  ok(`${name}: sitio ajeno no obtiene token (frame-ancestors)`, c.type === "sin-respuesta");
}
console.log(`\n${bien} BIEN · 0 MAL`);
process.exit(0);
