import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { StoreImage } from './StoreImage';

interface Props {
  /** URLs de las imágenes, en el orden en que se muestran en la galería. */
  images: string[];
  alt: string;
  startIndex: number;
  /** Avisa qué foto quedó a la vista, para que la galería quede en la misma. */
  onIndexChange?: (index: number) => void;
  onClose: () => void;
}

/** Estado visual de la foto: escala y desplazamiento en px. */
interface View {
  s: number;
  x: number;
  y: number;
}

const MAX_SCALE = 4;
/** Escala a la que salta el doble toque / doble click. */
const TAP_SCALE = 2.5;
/** Movimiento máximo (px) que sigue contando como "toque" y no como arrastre. */
const TAP_SLOP = 10;
/** Movimiento horizontal mínimo (px) para pasar de foto. */
const SWIPE_MIN = 50;

const IDLE: View = { s: 1, x: 0, y: 0 };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const touchDistance = (a: React.Touch, b: React.Touch) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

/** No deja que la foto se vaya de pantalla: el pan se limita al área ampliada. */
function clampView(v: View, rect: DOMRect): View {
  const maxX = Math.max(0, (rect.width * (v.s - 1)) / 2);
  const maxY = Math.max(0, (rect.height * (v.s - 1)) / 2);
  return { s: v.s, x: clamp(v.x, -maxX, maxX), y: clamp(v.y, -maxY, maxY) };
}

interface Gesture {
  mode: 'pinch' | 'pan' | 'swipe';
  /** Distancia entre los dos dedos al empezar (sólo pinch). */
  d0: number;
  /** Escala y desplazamiento al empezar el gesto. */
  s0: number;
  t0: { x: number; y: number };
  /** Punto donde arrancó: el dedo (pan/swipe) o el medio de los dos (pinch). */
  p0: { x: number; y: number };
  /** El punto del pinch, relativo al centro del visor. */
  f0: { x: number; y: number };
}

/**
 * Visor de fotos a pantalla completa (ficha de producto).
 *
 * POR QUÉ EXISTE
 * En mobile, el hover-zoom de la galería se disparaba con el dedo (un toque
 * emite un `mousemove` sintético) y quedaba trabado: no hay `mouseleave` que lo
 * saque, así que la foto se quedaba ampliada y sin salida. Tocar una foto ahora
 * la ABRE acá, y el zoom lo decide la persona con los dedos.
 *
 * DECISIONES QUE IMPORTAN
 *  - Va por PORTAL a <body>: `fixed inset-0` no alcanza cuando el visor cuelga
 *    de un contenedor con `transform` (cualquier transform es containing block
 *    de sus descendientes `fixed`), y además las barras fijas de mobile lo
 *    taparían. Mismo motivo que ReelsViewer.
 *  - El pinch es PROPIO, no el del navegador: con `touch-action: none` se apaga
 *    el gesto nativo (que ampliaría toda la página y dejaría a la persona
 *    perdida, que es justo el problema que vinimos a resolver) y se maneja acá,
 *    con tope de escala y siempre con salida a mano.
 *  - Un toque simple con la foto sin ampliar CIERRA. Es la salida más a mano en
 *    mobile; la X está igual, siempre visible.
 */
export function ImageLightbox({ images, alt, startIndex, onIndexChange, onClose }: Props) {
  const [idx, setIdx] = useState(() => clamp(startIndex, 0, Math.max(0, images.length - 1)));
  const [view, setView] = useState<View>(IDLE);
  const stageRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  /** Momento del último toque, para distinguir toque simple de doble toque. */
  const lastTap = useRef(0);
  /** Momento del último gesto táctil: descarta el click sintético que viene atrás. */
  const lastTouch = useRef(0);

  const hasMany = images.length > 1;
  const src = images[idx];

  const goTo = useCallback(
    (i: number) => {
      if (i < 0 || i >= images.length) return;
      setIdx(i);
      setView(IDLE);
      onIndexChange?.(i);
    },
    [images.length, onIndexChange],
  );

  // Bloquea el scroll del body mientras el visor está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape cierra; las flechas pasan de foto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key === 'ArrowRight') goTo(idx + 1);
      if (e.key === 'ArrowLeft') goTo(idx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goTo, idx]);

  /** Amplía (o vuelve a 1) dejando quieto el punto que se tocó. */
  const zoomAt = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (view.s > 1) {
      setView(IDLE);
      return;
    }
    const f = {
      x: clientX - (rect.left + rect.width / 2),
      y: clientY - (rect.top + rect.height / 2),
    };
    setView(
      clampView(
        { s: TAP_SCALE, x: f.x - (f.x - view.x) * TAP_SCALE, y: f.y - (f.y - view.y) * TAP_SCALE },
        rect,
      ),
    );
  };

  const onTouchStart = (e: React.TouchEvent) => {
    lastTouch.current = Date.now();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (e.touches.length >= 2) {
      const a = e.touches[0];
      const b = e.touches[1];
      const mid = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
      gesture.current = {
        mode: 'pinch',
        d0: touchDistance(a, b) || 1,
        s0: view.s,
        t0: { x: view.x, y: view.y },
        p0: mid,
        f0: { x: mid.x - cx, y: mid.y - cy },
      };
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      gesture.current = {
        mode: view.s > 1 ? 'pan' : 'swipe',
        d0: 0,
        s0: view.s,
        t0: { x: view.x, y: view.y },
        p0: { x: t.clientX, y: t.clientY },
        f0: { x: 0, y: 0 },
      };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!g || !rect) return;
    lastTouch.current = Date.now();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    if (g.mode === 'pinch' && e.touches.length >= 2) {
      const a = e.touches[0];
      const b = e.touches[1];
      const s = clamp((g.s0 * touchDistance(a, b)) / g.d0, 1, MAX_SCALE);
      // El punto entre los dedos también se mueve: la foto lo sigue.
      const f = { x: (a.clientX + b.clientX) / 2 - cx, y: (a.clientY + b.clientY) / 2 - cy };
      const k = s / g.s0;
      setView(
        clampView({ s, x: f.x - (g.f0.x - g.t0.x) * k, y: f.y - (g.f0.y - g.t0.y) * k }, rect),
      );
      return;
    }

    if (g.mode === 'pan' && e.touches.length === 1) {
      const t = e.touches[0];
      setView(
        clampView(
          { s: g.s0, x: g.t0.x + (t.clientX - g.p0.x), y: g.t0.y + (t.clientY - g.p0.y) },
          rect,
        ),
      );
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const g = gesture.current;
    lastTouch.current = Date.now();
    // Mientras quede un dedo apoyado el gesto sigue: se rearma en el próximo
    // touchstart (soltar un dedo del pinch dispara touchend igual).
    if (e.touches.length > 0) {
      gesture.current = null;
      return;
    }
    gesture.current = null;
    if (!g) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - g.p0.x;
    const dy = t.clientY - g.p0.y;
    const isTap = g.mode !== 'pinch' && Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP;

    if (!isTap) {
      if (g.mode === 'swipe' && Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
        goTo(idx + (dx < 0 ? 1 : -1));
      }
      return;
    }

    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Doble toque: amplía donde tocaste, o vuelve al tamaño original.
      lastTap.current = 0;
      zoomAt(t.clientX, t.clientY);
      return;
    }
    lastTap.current = now;
    // Con la foto ampliada el toque simple no cierra: se achica con doble toque
    // (o con la X). Así nadie sale sin querer mientras la está mirando de cerca.
    if (view.s > 1) return;
    window.setTimeout(() => {
      if (lastTap.current === now) onClose();
    }, 280);
  };

  /** El toque ya se resolvió en onTouchEnd: descarta el click sintético que sigue. */
  const isSyntheticClick = (e: React.MouseEvent) =>
    Date.now() - lastTouch.current < 600 || e.target !== e.currentTarget;

  const viewer = (
    <div className="fixed inset-0 z-[1200] bg-black" role="dialog" aria-modal="true" aria-label={alt}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-3 z-20 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <X className="h-5 w-5" />
      </button>

      {hasMany && (
        <>
          <button
            type="button"
            onClick={() => goTo(idx - 1)}
            disabled={idx === 0}
            aria-label="Foto anterior"
            className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm disabled:opacity-30 md:block"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(idx + 1)}
            disabled={idx === images.length - 1}
            aria-label="Foto siguiente"
            className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm disabled:opacity-30 md:block"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div
            className="absolute left-1/2 z-20 -translate-x-1/2 rounded-pill bg-black/50 px-3 py-1 text-[calc(12px_*_var(--font-scale,1))] text-white backdrop-blur-sm"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
          >
            {idx + 1} / {images.length}
          </div>
        </>
      )}

      <div
        ref={stageRef}
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={{ touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          gesture.current = null;
        }}
        onClick={(e) => {
          if (isSyntheticClick(e)) return;
          onClose();
        }}
        onDoubleClick={(e) => zoomAt(e.clientX, e.clientY)}
      >
        <StoreImage
          key={src}
          src={src}
          alt={alt}
          transformWidth={1600}
          loading="eager"
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`,
            transition: gesture.current ? 'none' : 'transform 150ms ease-out',
          }}
        />
      </div>
    </div>
  );

  return createPortal(viewer, document.body);
}
