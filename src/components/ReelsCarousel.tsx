import { useState } from 'react';
import { Play } from 'lucide-react';
import { ReelsViewer } from './ReelsViewer';
import type { Reel } from '@/lib/types';

interface Props {
  reels: Reel[];
  /** Título visible. En el home lo escribe el comercio; en la ficha es fijo. */
  title: string;
  /**
   * Ancho del contenedor, porque el carrusel vive en dos layouts distintos:
   *  - 'full'   (home): `max-w-none`, igual que ProductsSection/CategoriesSection.
   *  - 'detail' (ficha): `max-w-[1200px]`, igual que el bloque de compra, los
   *    breadcrumbs y "Así funciona tu compra".
   * Sin esto el carrusel de la ficha arrancaba pegado al borde de la pantalla,
   * desalineado de la foto y el precio.
   */
  width?: 'full' | 'detail';
  /**
   * 'column': el carrusel vive en la columna derecha de la ficha (~400px, y 267px
   * a 768px). Saca el ancho máximo, el padding de sección y el scroll a sangre
   * —que en una columna se sale del contenedor— y achica las tarjetas para que
   * entren dos y media. Se mantiene el scroll horizontal en vez de apilar: tres
   * 9:16 apilados hacen una columna de 1500px de alto.
   */
  variant?: 'section' | 'column';
}

/** mm:ss desde milisegundos. Vacío si no hay duración conocida. */
function formatDuration(ms: number | null): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Carrusel horizontal de PORTADAS. No monta ni un <video>: el peso del video
 * recién se paga cuando el usuario abre el visor. Ese era el punto flojo del
 * enfoque ingenuo (una grilla de <video> se come cientos de MB en mobile).
 *
 * Las tarjetas son 9:16 y el contenedor deja el borde derecho "cortado" a
 * propósito: ver medio video asomando le dice al ojo que hay más para deslizar,
 * sin necesidad de flechas.
 */
export function ReelsCarousel({ reels, title, width = 'full', variant = 'section' }: Props) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (reels.length === 0) return null;

  const column = variant === 'column';

  if (column) {
    return (
      <section>
        {title.trim() && <p className="mb-3 text-[13px] font-semibold text-muted">{title}</p>}
        <div className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
          {reels.map((reel, i) => (
            <button
              key={reel.id}
              type="button"
              onClick={() => setOpenAt(i)}
              aria-label={reel.caption || `Ver video ${i + 1}`}
              className="group w-[104px] flex-shrink-0 snap-start text-left"
            >
              <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-secondary">
                <img
                  src={reel.poster_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
                    <Play className="h-3.5 w-3.5 fill-white text-white" />
                  </span>
                </span>
              </div>
            </button>
          ))}
        </div>
        {openAt !== null && <ReelsViewer reels={reels} startIndex={openAt} onClose={() => setOpenAt(null)} />}
      </section>
    );
  }

  return (
    // El contenedor sale de `width` porque cada layout tiene el suyo: el home
    // usa `max-w-none px-6` (igual que ProductsSection/CategoriesSection) y la
    // ficha `max-w-[1200px] px-6` (igual que el bloque de compra). Fijar uno
    // solo desalineaba el carrusel en el otro.
    <section className={`mx-auto px-6 py-8 md:py-16 ${width === 'detail' ? 'max-w-[1200px]' : 'max-w-none'}`}>
      {/* Sin título no se pinta el <h2> NI su margen: si el comercio lo borró
          desde el editor, el carrusel arranca pegado a lo anterior en vez de
          dejar un hueco huérfano. Mismo criterio que SectionHeader. */}
      {title.trim() && (
        <h2 className="mb-4 font-heading text-[20px] font-semibold uppercase tracking-[1px] text-text md:text-[24px]">
          {title}
        </h2>
      )}

      {/* `-mx-6 px-6` deja el scroll a sangre (las tarjetas se deslizan hasta el
          borde de la pantalla) pero mantiene la primera alineada con el título.
          El corte de la última contra el borde sale solo del ancho de las
          tarjetas: no se fuerza con padding, así un carrusel de 2 videos en
          desktop no simula un scroll que no existe. */}
      <div className="no-scrollbar -mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 md:gap-4">
        {reels.map((reel, i) => {
          const dur = formatDuration(reel.duration_ms);
          return (
            <button
              key={reel.id}
              type="button"
              onClick={() => setOpenAt(i)}
              aria-label={reel.caption || `Ver video ${i + 1}`}
              className="group w-[138px] flex-shrink-0 snap-start text-left md:w-[180px] lg:w-[240px]"
            >
              <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-secondary">
                <img
                  src={reel.poster_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm md:h-11 md:w-11">
                    <Play className="h-4 w-4 fill-white text-white md:h-5 md:w-5" />
                  </span>
                </span>
                {dur && (
                  <span className="absolute right-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {dur}
                  </span>
                )}
                {/* Epígrafe DENTRO de la tarjeta, abajo, sobre fondo SÓLIDO (no
                    un gradiente sobre el frame): así se lee igual sea cual sea
                    la portada, y la tarjeta se ve como una unidad. */}
                {reel.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-background px-2.5 py-2">
                    <p className="line-clamp-2 text-[12px] leading-snug text-text md:text-[13px]">
                      {reel.caption}
                    </p>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {openAt !== null && (
        <ReelsViewer reels={reels} startIndex={openAt} onClose={() => setOpenAt(null)} />
      )}
    </section>
  );
}
