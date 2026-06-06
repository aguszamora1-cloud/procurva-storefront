import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { ResolvedStorefront } from '@/lib/types';

/**
 * Gate de acceso para la tienda mayorista protegida con código. No requiere
 * registro ni cuenta: el comercio comparte un código con sus clientes
 * mayoristas. Al validar (verify_storefront_password), se desbloquea la sesión
 * vía StoreProvider.unlock() y se entrega la config completa de la tienda.
 */
export function WholesalePasswordGate() {
  const { slug, pendingStore, unlock } = useStoreStatus();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slug || !password.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('verify_storefront_password', {
        p_slug: slug,
        p_password: password.trim(),
      });
      const resolved = data as ResolvedStorefront | null;
      if (rpcError || !resolved || !resolved.company_id) {
        setError('Código incorrecto');
        setSubmitting(false);
        return;
      }
      unlock(resolved);
    } catch {
      setError('No pudimos validar el código. Probá de nuevo.');
      setSubmitting(false);
    }
  }

  const name = pendingStore?.name ?? 'Tienda mayorista';
  const logoUrl = pendingStore?.logoUrl ?? '';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center text-neutral-900">
      <div className="w-full max-w-sm">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="mx-auto mb-8 max-h-16 w-auto object-contain" />
        ) : (
          <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-md bg-neutral-900">
            <span className="text-xl font-extrabold text-white">
              {(name.charAt(0) || 'P').toUpperCase()}
            </span>
          </div>
        )}

        <h1 className="text-xl font-extrabold uppercase tracking-tight md:text-2xl">{name}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Tienda mayorista. Ingresá el código de acceso que te dio el comercio.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-3 text-left">
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError('');
            }}
            placeholder="Código de acceso"
            autoFocus
            autoComplete="off"
            className="w-full border border-neutral-300 px-4 py-3.5 text-sm outline-none transition-colors focus:border-neutral-900"
          />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !password.trim()}
            className="w-full bg-neutral-900 px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Verificando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-10 text-xs text-neutral-400">Powered by ProCurva</p>
      </div>
    </div>
  );
}
