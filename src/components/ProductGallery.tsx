import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  images: string[];
  alt: string;
  /** Índice forzado desde afuera (ej: al elegir un color). */
  activeIndex?: number;
}

export function ProductGallery({ images, alt, activeIndex }: Props) {
  const [idx, setIdx] = useState(0);
  const current = activeIndex ?? idx;
  const safeIdx = images.length > 0 ? Math.min(current, images.length - 1) : 0;

  if (images.length === 0) {
    return <div className="aspect-square w-full bg-secondary" />;
  }

  const go = (next: number) => setIdx((next + images.length) % images.length);

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto md:max-h-[560px] md:flex-col md:overflow-y-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-20 w-16 shrink-0 overflow-hidden border ${
                i === safeIdx ? 'border-accent' : 'border-line'
              }`}
            >
              <img src={img} alt={`${alt} ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Imagen principal */}
      <div className="relative aspect-square flex-1 overflow-hidden bg-secondary">
        <img src={images[safeIdx]} alt={alt} className="h-full w-full object-cover" />
        {images.length > 1 && (
          <>
            <button
              aria-label="Anterior"
              onClick={() => go(safeIdx - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 p-1.5 shadow"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              aria-label="Siguiente"
              onClick={() => go(safeIdx + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 p-1.5 shadow"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
