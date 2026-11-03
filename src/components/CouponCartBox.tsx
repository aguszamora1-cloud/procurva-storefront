import { useState } from 'react';
import { Tag } from 'lucide-react';
import { useCoupon } from '@/context/CouponContext';
import { CouponChip } from './CouponChip';
import type { CartItem, StoreType } from '@/lib/types';

interface Props {
  items: CartItem[];
  storeType: StoreType;
  /** Si el carrito tiene una promo automática NO acumulable, el cupón se bloquea. */
  hasNonStackablePromo: boolean;
  className?: string;
}

/**
 * Cupón en el carrito (lateral y página): el chip del cupón guardado + "¿Tenés un
 * cupón?" para escribir el código sin esperar al checkout. Aplicar acá guarda el
 * cupón como aplicado en CouponContext, así que el checkout ya lo recibe aplicado.
 * El monto exacto queda para el checkout (depende del medio de pago y de las promos
 * por cantidad); acá el chip muestra el descuento nominal (-10% / -$X).
 */
export function CouponCartBox({ items, storeType, hasNonStackablePromo, className = '' }: Props) {
  const { savedCoupon, couponRecord, saveCoupon } = useCoupon();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState('');

  const hasChip = !!savedCoupon && !!couponRecord;
  const isApplied = hasChip && savedCoupon.applied;

  async function apply() {
    const code = input.trim();
    if (!code) return;
    setStatus('loading');
    setError('');
    const res = await saveCoupon(code, { applied: true });
    setStatus('idle');
    if (!res.ok) {
      setError(res.error || 'El código no es válido.');
      return;
    }
    setInput('');
    setOpen(false);
  }

  return (
    <div className={className}>
      <CouponChip
        items={items}
        mode="card"
        storeType={storeType}
        hasNonStackablePromo={hasNonStackablePromo}
        showAmount={false}
      />
      {!isApplied &&
        (open ? (
          <div className={hasChip ? 'mt-2' : ''}>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-button border border-line bg-background px-3 py-2 text-[calc(14px_*_var(--font-scale,1))] text-text outline-none focus:border-accent"
                value={input}
                onChange={(e) => { setInput(e.target.value.toUpperCase()); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
                placeholder="Código de cupón"
                aria-label="Código de cupón"
                autoCapitalize="characters"
                autoComplete="off"
                autoFocus
              />
              <button
                type="button"
                onClick={apply}
                disabled={status === 'loading' || !input.trim()}
                className="shrink-0 rounded-button border border-line px-4 text-[calc(13px_*_var(--font-scale,1))] font-semibold text-text transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'loading' ? '…' : 'Aplicar'}
              </button>
            </div>
            {error && <p className="mt-1.5 text-[calc(12px_*_var(--font-scale,1))] font-medium text-red-600">{error}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`inline-flex items-center gap-1.5 text-[calc(13px_*_var(--font-scale,1))] font-medium text-accent transition-opacity hover:opacity-80 ${hasChip ? 'mt-2' : ''}`}
          >
            <Tag className="h-4 w-4" /> {hasChip ? '¿Tenés otro cupón?' : '¿Tenés un cupón?'}
          </button>
        ))}
    </div>
  );
}
