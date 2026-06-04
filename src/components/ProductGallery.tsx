import { useEffect, useState } from 'react';

interface Props {
  images: string[];
  alt: string;
  /** Índice forzado desde afuera (ej: al elegir un color). */
  activeIndex?: number;
}

/**
 * Galería con hover-zoom en desktop. Thumbnails: columna vertical 80px a la
 * izquierda en desktop, fila horizontal con scroll debajo en mobile. Réplica
 * del ProductGallery de RSW.
 */
export function ProductGallery({ images, alt, activeIndex }: Props) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof activeIndex === 'number') setIdx(activeIndex);
  }, [activeIndex]);

  const hasMany = images.length > 1;
  const safeIdx = images.length > 0 ? Math.min(idx, images.length - 1) : 0;
  const active = images[safeIdx] ?? null;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setZoom({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  const thumb = (src: string, i: number, sizeCls: string) => (
    <button
      key={`${src}-${i}`}
      type="button"
      onClick={() => setIdx(i)}
      aria-label={`Imagen ${i + 1}`}
      className={`${sizeCls} flex-shrink-0 overflow-hidden transition-opacity ${
        i === safeIdx ? 'border-2 border-text opacity-100' : 'border border-line opacity-70 hover:opacity-100'
      }`}
    >
      <img src={src} alt="" className="h-full w-full object-cover" />
    </button>
  );

  return (
    <>
      <div className={hasMany ? 'md:grid md:grid-cols-[80px_1fr] md:gap-3' : ''}>
        {hasMany && (
          <div className="no-scrollbar hidden md:flex md:max-h-[600px] md:flex-col md:gap-2 md:overflow-y-auto">
            {images.map((src, i) => thumb(src, i, 'w-20 h-20'))}
          </div>
        )}

        <div
          className="relative aspect-[3/4] cursor-zoom-in overflow-hidden rounded-[12px] bg-secondary"
          onMouseMove={handleMove}
          onMouseLeave={() => setZoom(null)}
        >
          {active ? (
            <img
              src={active}
              alt={alt}
              className="h-full w-full object-cover transition-transform duration-200"
              style={zoom ? { transform: 'scale(1.6)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[12px] font-semibold uppercase tracking-[1px] text-subtle">
              Sin imagen
            </div>
          )}
        </div>
      </div>

      {hasMany && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto md:hidden">
          {images.map((src, i) => thumb(src, i, 'w-20 h-24'))}
        </div>
      )}
    </>
  );
}
