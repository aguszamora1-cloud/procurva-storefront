// Prueba de src/lib/tryonAvailability.ts (botón del probador, F0.5).
// Uso: node --test scripts/tryon-availability.test.mjs   (Node 22.6+ quita los tipos solo)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAIL_TTL_MS, OK_TTL_MS, resetTryonAvailabilityCache, tryonAvailable } from '../src/lib/tryonAvailability.ts';

const CO = '71ee0d15-57c6-4f9d-9f3e-0585e2479d71';

test('10 componentes a la vez = UNA consulta; después se reusa la respuesta', async () => {
  resetTryonAvailabilityCache();
  let calls = 0;
  const rpc = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return true; };
  const out = await Promise.all(Array.from({ length: 10 }, () => tryonAvailable(CO, rpc, () => 0)));
  assert.deepEqual(new Set(out), new Set([true]));
  assert.equal(calls, 1);
  assert.equal(await tryonAvailable(CO, rpc, () => OK_TTL_MS - 1), true);
  assert.equal(calls, 1);
  await tryonAvailable(CO, rpc, () => OK_TTL_MS + 1);
  assert.equal(calls, 2, 'vencida la respuesta, vuelve a consultar');
});

test('si la consulta falla: "no disponible" y NO se reintenta durante FAIL_TTL_MS', async () => {
  resetTryonAvailabilityCache();
  let calls = 0;
  const rpc = async () => { calls++; throw new Error('base caída'); };
  for (let i = 0; i < 50; i++) assert.equal(await tryonAvailable(CO, rpc, () => i * 100), false);
  assert.equal(calls, 1, '50 vistas durante la caída = 1 consulta');
  await tryonAvailable(CO, rpc, () => FAIL_TTL_MS + 1);
  assert.equal(calls, 2);
});

test('sólo true explícito habilita; cualquier otra respuesta oculta el botón', async () => {
  for (const v of [false, null, undefined, 'true', 1, {}]) {
    resetTryonAvailabilityCache();
    assert.equal(await tryonAvailable(CO, async () => v, () => 0), false, String(v));
  }
  resetTryonAvailabilityCache();
  assert.equal(await tryonAvailable('', async () => true), false, 'sin empresa no consulta');
});
