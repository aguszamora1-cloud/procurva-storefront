import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { StoreImage } from './StoreImage';

/** Ítem de la galería: imagen o video (con poster). */
export interface GalleryItem {
  kind: 'image' | 'video';
  src: string;
  /** Poster del video (thumbnail_url). Sólo para kind==='video'. */
  poster?: string;
  /** Encuadre del video (CSS object-position). Sólo para kind==='video'. */
  objectPosition?: string;
}

interface Props {
  items: GalleryItem[];
  alt: string;
  /** Índice forzado desde afuera (ej: al elegir un color). */
  activeIndex?: number;
}

/**
 * Galería mixta (imágenes + videos). Imágenes: hover-zoom en desktop (igual que
 * antes). Videos: <video preload="none" poster controls playsInline>, sólo se
 * cargan al interactuar. Thumbnails: columna vertical 80px a la izquierda en
 * desktop, fila horizontal con scroll debajo en mobile.
 */
export function ProductGallery({ items, alt, activeIndex }: Props) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof activeIndex === 'number') setIdx(activeIndex);
  }, [activeIndex]);

  const hasMany = items.length > 1;
  const safeIdx = items.length > 0 ? Math.min(idx, items.length - 1) : 0;
  const active = items[safeIdx] ?? null;
  const activeIsVideo = active?.kind === 'video';

  // Al cambiar de slide, pausamos el video que estaba sonando.
  useEffect(() => {
    const v = videoRef.current;
    if (v && !v.paused) v.pause();
  }, [safeIdx]);

  const goTo = (i: number) => setIdx(Math.max(0, Math.min(i, items.length - 1)));

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeIsVideo) return; // sin zoom en videos
    const rect = e.currentTarget.getBoundingClientRect();
    setZoom({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  // Swipe táctil (mobile) para pasar entre fotos y videos. En un video se ignora
  // el swipe que arranca sobre la barra de controles (abajo) para no chocar con
  // el play/scrubber. Sólo actuamos si el gesto es claramente horizontal.
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (items.length < 2) { touchRef.current = null; return; }
    const t = e.touches[0];
    if (activeIsVideo) {
      const rect = e.currentTarget.getBoundingClientRect();
      if ((t.clientY - rect.top) / rect.height > 0.8) { touchRef.current = null; return; }
    }
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || items.length < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return;
    goTo(dx < 0 ? safeIdx + 1 : safeIdx - 1);
  };

  const thumb = (item: GalleryItem, i: number, sizeCls: string) => (
    <button
      key={`${item.src}-${i}`}
      type="button"
      onClick={() => setIdx(i)}
      aria-label={item.kind === 'video' ? `Video ${i + 1}` : `Imagen ${i + 1}`}
      className={`${sizeCls} relative flex-shrink-0 overflow-hidden transition-opacity ${
        i === safeIdx ? 'border-2 border-text opacity-100' : 'border border-line opacity-70 hover:opacity-100'
      }`}
    >
      {item.kind === 'video' && item.poster ? (
        <StoreImage src={item.poster} alt="" transformWidth={160} className="h-full w-full object-cover" style={{ objectPosition: item.objectPosition || '50% 50%' }} />
      ) : item.kind === 'video' ? (
        <span className="flex h-full w-full items-center justify-center bg-secondary" />
      ) : (
        <StoreImage src={item.src} alt="" transformWidth={160} width={80} height={96} className="h-full w-full object-cover" />
      )}
      {item.kind === 'video' && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50">
            <Play className="h-3.5 w-3.5 fill-white text-white" />
          </span>
        </span>
      )}
    </button>
  );

  return (
    <>
      <div className={hasMany ? 'md:grid md:grid-cols-[80px_1fr] md:gap-3' : ''}>
        {hasMany && (
          <div className="no-scrollbar hidden md:flex md:max-h-[600px] md:flex-col md:gap-2 md:overflow-y-auto">
            {items.map((item, i) => thumb(item, i, 'w-20 h-20'))}
          </div>
        )}

        <div
          className={`relative aspect-[3/4] overflow-hidden rounded-[12px] bg-secondary md:max-h-[80vh] ${
            activeIsVideo ? '' : 'cursor-zoom-in'
          }`}
          onMouseMove={handleMove}
          onMouseLeave={() => setZoom(null)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {active && activeIsVideo ? (
            <video
              ref={videoRef}
              src={active.src}
              poster={active.poster}
              controls
              playsInline
              preload="none"
              className="h-full w-full object-cover"
              style={{ objectPosition: active.objectPosition || '50% 50%' }}
            />
          ) : active ? (
            <StoreImage
              src={active.src}
              alt={alt}
              transformWidth={1000}
              loading="eager"
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
          {items.map((item, i) => thumb(item, i, 'w-20 h-24'))}
        </div>
      )}
    </>
  );
}
