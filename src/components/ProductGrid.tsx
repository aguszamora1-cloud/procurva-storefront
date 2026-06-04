import { useEffect, useRef } from 'react';
import type { Product } from '@/lib/types';
import { ProductCard } from './ProductCard';
import { mainImage } from '@/lib/utils';
import { transformedSrc } from '@/lib/images';

/**
 * Prefetch de las imágenes de la grilla que están por entrar al viewport.
 * Observa cada card y, cuando se acerca (rootMargin 600px), precarga su imagen
 * en thumbnail transformado para que aparezca instantánea al hacer scroll.
 */
function useViewportImagePrefetch(products: Product[]) {
  const refs = useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const done = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.idx);
          if (done.has(idx)) continue;
          done.add(idx);
          observer.unobserve(entry.target);
          const url = mainImage(products[idx]);
          if (url) {
            const img = new Image();
            img.src = transformedSrc(url, { width: 500 });
          }
        }
      },
      { rootMargin: '600px 0px' },
    );
    refs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [products]);

  return (idx: number) => (el: HTMLElement | null) => {
    if (el) refs.current.set(idx, el);
    else refs.current.delete(idx);
  };
}

export function ProductGrid({ products }: { products: Product[] }) {
  const setRef = useViewportImagePrefetch(products);

  if (products.length === 0) {
    return <p className="py-16 text-center text-[14px] text-subtle">No hay productos para mostrar.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-5">
      {products.map((p, i) => (
        // La primera fila carga eager (mejora LCP); el resto lazy + prefetch.
        <div key={p.id} ref={setRef(i)} data-idx={i}>
          <ProductCard product={p} priority={i < 4} />
        </div>
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col border border-line-soft bg-background">
          <div className="aspect-[4/5] animate-pulse bg-secondary" />
          <div className="space-y-2 p-2.5 md:p-4">
            <div className="h-3 w-3/4 animate-pulse bg-secondary" />
            <div className="h-3 w-1/3 animate-pulse bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}
