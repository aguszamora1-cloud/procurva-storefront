import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Volume2, VolumeX } from 'lucide-react';
import type { Reel } from '@/lib/types';

interface Props {
  reels: Reel[];
  startIndex: number;
  onClose: () => void;
}

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
 */
export function ReelsViewer({ reels, startIndex, onClose }: Props) {
  const [active, setActive] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

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

  // Cerrar con Escape (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  return (
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

      <div
        ref={containerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reels.map((reel, i) => {
          // Ventana de montaje: sólo anterior / actual / siguiente.
          const mounted = Math.abs(i - active) <= 1;
          return (
            <div
              key={reel.id}
              data-index={i}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              className="relative flex h-full w-full snap-start items-center justify-center"
            >
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
                  className="h-full w-full object-contain"
                />
              ) : (
                // Fuera de la ventana: sólo el poster, sin <video> montado.
                <img src={reel.poster_url} alt="" className="h-full w-full object-contain" />
              )}

              {(reel.caption || reel.product_id) && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pb-6 pt-12">
                  {reel.caption && (
                    <p className="mb-3 text-[14px] leading-snug text-white">{reel.caption}</p>
                  )}
                  {reel.product_id && (
                    <Link
                      to={`/producto/${reel.product_id}`}
                      onClick={onClose}
                      className="pointer-events-auto inline-flex items-center rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black"
                    >
                      Ver producto
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
