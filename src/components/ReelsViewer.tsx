import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { X, Volume2, VolumeX, ChevronUp, ChevronDown } from 'lucide-react';
import { ReelProductCard, reelProductId, useReelProducts } from './ReelProductCard';
import type { Reel } from '@/lib/types';

interface Props {
  reels: Reel[];
  startIndex: number;
  onClose: () => void;
}

/** Formato en el que se piden los videos. Se usa hasta que el <video> reporta el suyo. */
const DEFAULT_RATIO = 9 / 16;

/**
 * Visor fullscreen de videos verticales.
 *
 * Decisiones que importan para que ande en mobile:
 *  - El scroll vertical es CSS puro (`scroll-snap-type: y mandatory`). Sin
 *    librería de swipe: el scroll nativo es más fluido y no pelea con el gesto
 *    del sistema.
 *  - Sólo se MONTAN 3 <video> (anterior/actual/siguiente). Con 20 videos
 *    montados, mobile se come cientos de MB y se traba.
 *  - IntersectionObserver decide qué video reproduce: el que ocupa el viewport
 *    juega, el resto se pausa. No alcanza con el índice, porque durante el
 *    scroll hay dos parcialmente visibles.
 *  - `muted` y `playsInline` son OBLIGATORIOS: sin muted el autoplay lo bloquea
 *    el navegador, y sin playsInline iOS abre el video en su reproductor
 *    fullscreen nativo y se pierde el visor.
 *  - Va por PORTAL a <body>. `fixed inset-0` NO alcanza: el visor cuelga de una
 *    sección envuelta en <Reveal>, que aplica `transform: translateY(...)` para
 *    el fade de entrada, y cualquier transform (incluso la identidad) convierte
 *    al elemento en containing block de sus descendientes `fixed`. Sin el portal
 *    el "fullscreen" medía lo mismo que la sección del carrusel (~600px) y el
 *    resto del home quedaba a la vista abajo. Mismo motivo por el que el modal
 *    de OutfitsSection ya se portaba.
 */
export function ReelsViewer({ reels, startIndex, onClose }: Props) {
  const [active, setActive] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  // Alto/ancho reales del visor y formato de cada video: con eso se calcula el
  // recuadro EXACTO que ocupa el video, para poder pegarle la card adentro.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [ratios, setRatios] = useState<Record<number, number>>({});

  // Posiciona el slide inicial sin animación (antes del primer paint útil).
  useEffect(() => {
    const el = slideRefs.current[startIndex];
    if (el) el.scrollIntoView({ block: 'start', behavior: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bloquea el scroll del body mientras el visor está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /**
   * Navegación explícita entre videos (flechas, teclado, rueda del mouse).
   *
   * En mobile alcanza con el swipe, pero en desktop el visor no daba ninguna
   * pista de que hubiera más videos: la rueda scrolleaba de a píxeles contra el
   * snap y no había nada para clickear.
   *
   * `navLock` existe porque un gesto de trackpad dispara decenas de eventos
   * wheel: sin el candado, un solo gesto se saltaba media docena de videos.
   */
  const navLock = useRef(false);
  const goTo = useCallback(
    (i: number) => {
      const idx = Math.max(0, Math.min(i, reels.length - 1));
      const el = slideRefs.current[idx];
      if (!el || navLock.current) return;
      navLock.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => {
        navLock.current = false;
      }, 450);
    },
    [reels.length],
  );

  // Escape cierra; flechas y AvPág/RePág navegan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(active + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(active - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goTo, active]);

  // Rueda del mouse / trackpad: un gesto = un video. Se toma el control del
  // scroll (passive:false + preventDefault) en vez de dejar el snap nativo, que
  // con una rueda de clicks discretos frenaba a mitad de camino entre dos
  // videos y volvía al que ya estabas viendo.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 8) return;
      e.preventDefault();
      goTo(active + (e.deltaY > 0 ? 1 : -1));
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [active, goTo]);

  // Qué slide está en viewport -> ese es el activo.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const i = Number((entry.target as HTMLElement).dataset.index);
            if (Number.isFinite(i)) setActive(i);
          }
        }
      },
      { root, threshold: [0.6] },
    );
    slideRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [reels.length]);

  // Play/pause según el activo. Se hace acá (y no en el observer) para que
  // también se aplique cuando cambia `active` por el montaje inicial.
  useEffect(() => {
    for (const [key, video] of Object.entries(videoRefs.current)) {
      if (!video) continue;
      if (Number(key) === active) {
        video.muted = muted;
        void video.play().catch(() => {
          /* autoplay bloqueado: queda el poster, el usuario puede tocar */
        });
      } else {
        video.pause();
      }
    }
  }, [active, muted]);

  const setVideoRef = useCallback((i: number) => (el: HTMLVideoElement | null) => {
    videoRefs.current[i] = el;
  }, []);

  // Medida del visor. useLayoutEffect (no useEffect) para que el primer paint ya
  // salga con el recuadro bien: si no, se ve un frame con la card a lo ancho de
  // la pantalla y después salta.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Formato real del video, apenas el navegador lee los metadatos. No se asume
  // 9:16 y listo: si el comercio sube un 4:5 o un cuadrado, la card tiene que
  // quedar sobre ESE recuadro y no sobre la franja negra.
  const onMeta = useCallback((i: number) => (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (!v.videoWidth || !v.videoHeight) return;
    const r = v.videoWidth / v.videoHeight;
    setRatios((prev) => (prev[i] === r ? prev : { ...prev, [i]: r }));
  }, []);

  /**
   * Recuadro que el video ocupa de verdad dentro del slide — lo mismo que
   * calcula `object-contain`, pero como caja real para poder anclarle la card
   * adentro. Sin esto la card colgaba del borde del SLIDE (todo el ancho de la
   * pantalla), así que en desktop flotaba sobre las bandas negras, más ancha
   * que el video y despegada de él.
   */
  const stageStyle = (i: number): CSSProperties => {
    if (!box) return { width: '100%', height: '100%' };
    const r = ratios[i] ?? DEFAULT_RATIO;
    const w = Math.min(box.w, box.h * r);
    return { width: w, height: w / r };
  };

  // Productos comprables de estos videos, resueltos de una sola vez (no se puede
  // pedir por slide: los hooks no van dentro del map).
  const productsByReel = useReelProducts(reels);

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black">
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-3 top-3 z-20 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm"
      >
        <X className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? 'Activar sonido' : 'Silenciar'}
        className="absolute right-3 top-16 z-20 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm"
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {/* Flechas de navegación. Sólo desde `md`: en mobile el swipe ya es el
          gesto natural y dos botones encima del video tapan la card del
          producto. Se ocultan en los extremos en vez de quedar deshabilitadas —
          un botón apagado en un visor a pantalla completa se lee como un bug. */}
      {reels.length > 1 && (
        <div className="pointer-events-none absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 md:flex">
          {active > 0 && (
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              aria-label="Video anterior"
              className="pointer-events-auto rounded-full bg-white/15 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <ChevronUp className="h-6 w-6" />
            </button>
          )}
          {active < reels.length - 1 && (
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              aria-label="Video siguiente"
              className="pointer-events-auto rounded-full bg-white/15 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <ChevronDown className="h-6 w-6" />
            </button>
          )}
        </div>
      )}

      {/* Posición en la tanda: sin esto no hay forma de saber cuántos videos
          quedan. Vertical, pegada al borde izquierdo, para no competir con la
          card del producto. */}
      {reels.length > 1 && (
        <div className="pointer-events-none absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-1.5 md:flex">
          {reels.map((r, i) => (
            <span
              key={r.id}
              className={`h-5 w-1 rounded-full transition-colors ${i === active ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reels.map((reel, i) => {
          // Ventana de montaje: sólo anterior / actual / siguiente.
          const mounted = Math.abs(i - active) <= 1;
          const pid = reelProductId(reel);
          const product = pid ? productsByReel[pid] : undefined;
          return (
            <div
              key={reel.id}
              data-index={i}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              className="flex h-full w-full snap-start items-center justify-center"
            >
              {/* Escenario = el recuadro exacto del video. El epígrafe y la card
                  cuelgan de ACÁ (no del slide), así quedan adentro del video. */}
              <div className="relative overflow-hidden" style={stageStyle(i)}>
                {mounted ? (
                  <video
                    ref={setVideoRef(i)}
                    src={reel.url}
                    poster={reel.poster_url}
                    muted
                    playsInline
                    autoPlay={i === active}
                    loop
                    preload="metadata"
                    onLoadedMetadata={onMeta(i)}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  // Fuera de la ventana: sólo el poster, sin <video> montado.
                  <img src={reel.poster_url} alt="" className="h-full w-full object-contain" />
                )}

                {/* Epígrafe + card del producto vinculado. La card sólo aparece si
                    el producto existe y es visible en este canal: un vínculo a un
                    producto oculto o borrado no deja un cartel roto encima del
                    video, simplemente no se pinta. */}
                {(reel.caption || product) && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-4 pt-12">
                    {reel.caption && (
                      <p className="mb-2.5 text-[14px] leading-snug text-white">{reel.caption}</p>
                    )}
                    {product && <ReelProductCard product={product} onNavigate={onClose} onAdded={onClose} />}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
