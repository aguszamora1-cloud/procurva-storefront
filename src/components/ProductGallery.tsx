import { useEffect, useMemo, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { StoreImage } from './StoreImage';
import { ImageLightbox } from './ImageLightbox';

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
  /**
   * Avisa que la imagen principal ya está en pantalla (descargada, o que no hay
   * ninguna que esperar). Lo usa el gate de pintado de la ficha para no mostrar
   * la página con el hueco de la foto. Tiene que ser estable (useCallback).
   */
  onFirstImageReady?: () => void;
}

/**
 * Galería mixta (imágenes + videos). Videos: <video preload="none" poster
 * controls playsInline>, sólo se cargan al interactuar. Thumbnails: columna
 * vertical 80px a la izquierda en desktop, fila horizontal con scroll debajo en
 * mobile.
 *
 * Zoom de las imágenes:
 *  - Desktop (mouse de verdad): hover-zoom siguiendo el puntero, como siempre.
 *  - Mobile: NADA al pasar el dedo. El hover-zoom escuchaba `mousemove`, que el
 *    navegador también emite de forma sintética al tocar la pantalla, así que un
 *    toque dejaba la foto ampliada y sin salida: no hay `mouseleave` en táctil
 *    que la devuelva. Ahora el gesto se filtra por `pointerType` y el toque abre
 *    el visor a pantalla completa (ImageLightbox), donde se amplía con los dedos.
 */
export function ProductGallery({ items, alt, activeIndex, onFirstImageReady }: Props) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  /** Momento del último swipe: el click que viene atrás no tiene que abrir el visor. */
  const lastSwipe = useRef(0);

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

  // Si no hay imagen que esperar (galería vacía o el primer ítem es un video),
  // destrabamos el gate de una: el <img> nunca va a disparar onLoad.
  useEffect(() => {
    if (!onFirstImageReady) return;
    if (!active || activeIsVideo) onFirstImageReady();
  }, [active, activeIsVideo, onFirstImageReady]);

  const goTo = (i: number) => setIdx(Math.max(0, Math.min(i, items.length - 1)));

  // Al cambiar de foto no queda ampliada la anterior.
  useEffect(() => setZoom(null), [safeIdx]);

  // Sólo las imágenes van al visor: el índice de la galería incluye los videos,
  // así que hay que traducirlo a la posición dentro de la lista de fotos.
  const imageSrcs = useMemo(
    () => items.filter((it) => it.kind === 'image').map((it) => it.src),
    [items],
  );
  const lightboxIndex = active && !activeIsVideo ? Math.max(0, imageSrcs.indexOf(active.src)) : 0;

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Sólo con un mouse de verdad: en táctil el hover-zoom queda trabado.
    if (e.pointerType !== 'mouse' || activeIsVideo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setZoom({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  const openLightbox = () => {
    if (activeIsVideo || imageSrcs.length === 0) return;
    if (Date.now() - lastSwipe.current < 600) return; // veníamos de pasar de foto
    setZoom(null);
    setLightbox(true);
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
    lastSwipe.current = Date.now();
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
          className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary md:max-h-[80vh] ${
            activeIsVideo ? '' : 'cursor-zoom-in'
          }`}
          onPointerMove={handleMove}
          onPointerLeave={() => setZoom(null)}
          onPointerCancel={() => setZoom(null)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={openLightbox}
          role={activeIsVideo ? undefined : 'button'}
          aria-label={activeIsVideo ? undefined : 'Ver la foto en grande'}
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
              onLoad={onFirstImageReady}
              className="h-full w-full object-cover transition-transform duration-200"
              style={zoom ? { transform: 'scale(1.6)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[calc(12px_*_var(--font-scale,1))] font-semibold uppercase tracking-[1px] text-subtle">
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

      {lightbox && (
        <ImageLightbox
          images={imageSrcs}
          alt={alt}
          startIndex={lightboxIndex}
          onIndexChange={(i) => {
            // Al cerrar, la galería queda en la misma foto que se estaba viendo.
            const pos = items.findIndex((it) => it.kind === 'image' && it.src === imageSrcs[i]);
            if (pos >= 0) setIdx(pos);
          }}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  );
}
