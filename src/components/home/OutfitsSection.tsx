import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeader } from '@/components/SectionHeader';
import { useOutfits } from '@/hooks/useOutfits';
import { useProducts } from '@/hooks/useProducts';
import type { Outfit, Product } from '@/lib/types';
import { getPriceInfo, mainImage, formatPrice } from '@/lib/utils';

interface ResolvedOutfit {
  outfit: Outfit;
  products: Product[];
  total: number;
}

function OutfitCard({ data, onOpen }: { data: ResolvedOutfit; onOpen: () => void }) {
  const { outfit, products, total } = data;
  return (
    <article className="flex flex-col border border-line bg-[var(--color-background)]">
      <button onClick={onOpen} className="group relative block aspect-[3/4] overflow-hidden bg-secondary">
        {outfit.image_url ? (
          <img src={outfit.image_url} alt={outfit.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full w-full grid-cols-2">
            {products.slice(0, 4).map((p) => (
              <img key={p.id} src={mainImage(p) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" />
            ))}
          </div>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-heading text-[15px] font-semibold uppercase tracking-[0.5px] text-text md:text-[17px]">{outfit.name}</h3>
          {outfit.description && <p className="mt-1 text-[13px] text-muted">{outfit.description}</p>}
        </div>
        <div className="flex -space-x-2">
          {products.slice(0, 5).map((p) => (
            <img key={p.id} src={mainImage(p) ?? undefined} alt="" loading="lazy" className="h-9 w-9 rounded-full border-2 border-[var(--color-background)] object-cover" />
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div>
            <p className="text-[11px] uppercase tracking-[0.5px] text-muted">{products.length} productos</p>
            <p className="text-[16px] font-semibold text-text">{formatPrice(total)}</p>
          </div>
          <button onClick={onOpen} className="btn-accent px-4 py-2 text-[13px]">Ver outfit</button>
        </div>
      </div>
    </article>
  );
}

function OutfitModal({ data, onClose }: { data: ResolvedOutfit; onClose: () => void }) {
  const { outfit, products, total } = data;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[var(--color-background)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-heading text-[18px] font-semibold uppercase tracking-[0.5px] text-text">{outfit.name}</h2>
            {outfit.description && <p className="text-[13px] text-muted">{outfit.description}</p>}
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-muted hover:text-text" aria-label="Cerrar">&times;</button>
        </div>

        <div className="flex-1 divide-y divide-line overflow-y-auto">
          {products.map((p) => {
            const { mainPrice } = getPriceInfo(p);
            return (
              <Link key={p.id} to={`/producto/${p.id}`} onClick={onClose} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary">
                <img src={mainImage(p) ?? undefined} alt={p.name} className="h-16 w-16 shrink-0 rounded object-cover" />
                <span className="flex-1 text-[14px] text-text">{p.name}</span>
                <span className="text-[14px] font-semibold text-text">{formatPrice(mainPrice)}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-4">
          <span className="text-[13px] uppercase tracking-[0.5px] text-muted">Total del outfit</span>
          <span className="text-[18px] font-semibold text-text">{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  );
}

/** Sección de outfits / looks (Extra PRO). */
export function OutfitsSection() {
  const { outfits } = useOutfits();
  const { products } = useProducts();
  const [openId, setOpenId] = useState<string | null>(null);

  const resolved = useMemo<ResolvedOutfit[]>(() => {
    const map = new Map(products.map((p) => [p.id, p]));
    return outfits
      .map((outfit) => {
        const prods = outfit.items.map((it) => map.get(it.product_id)).filter((p): p is Product => Boolean(p));
        const total = prods.reduce((sum, p) => sum + (getPriceInfo(p).mainPrice ?? 0), 0);
        return { outfit, products: prods, total };
      })
      .filter((r) => r.products.length > 0);
  }, [outfits, products]);

  if (resolved.length === 0) return null;

  const open = resolved.find((r) => r.outfit.id === openId) ?? null;

  return (
    <section className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
      <SectionHeader label="Combiná tu look" title="Outfits" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {resolved.map((r) => (
          <OutfitCard key={r.outfit.id} data={r} onOpen={() => setOpenId(r.outfit.id)} />
        ))}
      </div>
      {open && <OutfitModal data={open} onClose={() => setOpenId(null)} />}
    </section>
  );
}
