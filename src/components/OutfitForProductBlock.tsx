import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { useOutfits } from '@/hooks/useOutfits';
import { StoreImage } from './StoreImage';
import { formatPrice, mainImage } from '@/lib/utils';
import { outfitImages, outfitPricing, outfitsContaining } from '@/lib/outfits';
import type { Product } from '@/lib/types';
import type { OutfitWithProducts } from '@/hooks/useOutfits';

interface Props {
  /** Producto de la ficha. */
  product: Product;
  className?: string;
}

/**
 * "Este producto es parte de un look": muestra el outfit que contiene el producto.
 * Dos presentaciones según config (`outfit_presentacion`): card destacada o fila en
 * lista. Si el producto está en varios outfits, el desempate (`outfit_desempate`)
 * elige UNO. Gateado por `mostrar_outfit`; se autooculta si el producto no está en
 * ningún outfit. Enlaza a las prendas del look (el producto actual va marcado).
 */
export function OutfitForProductBlock({ product, className }: Props) {
  const config = useStore();
  const { outfits, isLoading } = useOutfits();
  const block = config.complementaryBlock;

  const outfit = useMemo<OutfitWithProducts | null>(() => {
    const matches = outfitsContaining(outfits, product.id, block.outfitDesempate);
    return matches[0] ?? null;
  }, [outfits, product.id, block.outfitDesempate]);

  // A propósito NO se anota en el gate de pintado: useOutfits encadena TRES
  // queries (outfits → items → productos) y tarda ~2s, más que el tope de la
  // navegación. Retener la ficha entera por un bloque opcional del final de la
  // columna (sólo aparece si el producto está en un look) sale más caro que
  // dejarlo entrar después.
  if (!block.mostrarOutfit || isLoading || !outfit || outfit.products.length === 0) return null;

  const pricing = outfitPricing(outfit);
  const hero = outfitImages(outfit)[0] ?? null;
  const hasDual = pricing.comboCash > 0 && pricing.comboCash < pricing.comboCard;

  // Precio (contado protagonista, tarjeta secundaria) + ahorro del combo.
  const priceEl = (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {pricing.hasCombo && pricing.cashSaving > 0 && (
        <span className="text-xs text-subtle line-through">{formatPrice(pricing.cashSum)}</span>
      )}
      <span className="text-base font-bold text-accent">{formatPrice(pricing.comboCash)}</span>
      {hasDual && (
        <span className="text-[11px] text-subtle">
          <span className="font-semibold">{formatPrice(pricing.comboCard)}</span> con tarjeta
        </span>
      )}
    </div>
  );

  // Miniaturas de las prendas del look (el producto actual, marcado y sin link).
  const thumbs = (size: 'sm' | 'lg') => (
    <div className="flex flex-wrap gap-1.5">
      {outfit.products.map((p) => {
        const isCurrent = p.id === product.id;
        const dim = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
        const thumbSrc = mainImage(p);
        const inner = (
          <div
            className={`relative overflow-hidden rounded-lg border ${isCurrent ? 'border-accent' : 'border-line'} ${dim} bg-secondary`}
            title={isCurrent ? `${p.name} (este producto)` : p.name}
          >
            {thumbSrc && <StoreImage src={thumbSrc} alt={p.name} transformWidth={120} className="h-full w-full object-cover" />}
            {isCurrent && <span className="absolute inset-0 ring-2 ring-inset ring-accent" />}
          </div>
        );
        return isCurrent ? (
          <div key={p.id}>{inner}</div>
        ) : (
          <Link key={p.id} to={`/producto/${p.id}`}>
            {inner}
          </Link>
        );
      })}
    </div>
  );

  // ── Presentación EN LISTA (compacta) ──────────────────────────────────────
  if (block.outfitPresentacion === 'en_lista') {
    return (
      <section className={`rounded-2xl border border-line p-3 ${className ?? ''}`}>
        <div className="flex items-center gap-3">
          {hero ? (
            <StoreImage src={hero} alt={outfit.name} transformWidth={160} className="h-16 w-14 flex-shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="h-16 w-14 flex-shrink-0 rounded-lg bg-secondary" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Es parte de un look</p>
            <p className="truncate text-sm font-semibold text-text">{outfit.name}</p>
            <p className="text-[11px] text-subtle">{outfit.products.length} prendas</p>
            <div className="mt-1">{priceEl}</div>
          </div>
        </div>
      </section>
    );
  }

  // ── Presentación CARD DESTACADA (default) ─────────────────────────────────
  return (
    <section className={`overflow-hidden rounded-2xl border border-line ${className ?? ''}`}>
      {hero ? (
        <div className="relative aspect-[4/5] w-full bg-secondary">
          <StoreImage src={hero} alt={outfit.name} transformWidth={640} className="h-full w-full object-cover" />
          {pricing.hasCombo && pricing.cashSaving > 0 && (
            <span className="absolute left-3 top-3 rounded bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-on-accent">
              Combo · ahorrás {formatPrice(pricing.cashSaving)}
            </span>
          )}
        </div>
      ) : (
        <div className="grid aspect-[4/5] w-full grid-cols-2 bg-secondary">
          {outfit.products.slice(0, 4).map((p) => (
            <StoreImage key={p.id} src={mainImage(p) ?? ''} alt={p.name} transformWidth={320} className="h-full w-full object-cover" />
          ))}
        </div>
      )}
      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Es parte de un look</p>
        <h3 className="mb-1 font-heading text-lg font-semibold text-text">{outfit.name}</h3>
        {outfit.description && <p className="mb-2 text-xs text-subtle">{outfit.description}</p>}
        <div className="mb-3">{priceEl}</div>
        {thumbs('lg')}
      </div>
    </section>
  );
}
