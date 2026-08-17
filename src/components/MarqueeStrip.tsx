import type { CSSProperties } from 'react';

/**
 * Franja de mensajes en loop horizontal. Es el render compartido entre la barra
 * superior fija (AnnouncementBar) y las barras de anuncios que el comercio
 * agrega como sección en cualquier posición del home (CustomMarqueeSection).
 *
 * El track se duplica y la animación desplaza -50%: así el loop no salta. Los
 * mensajes se repiten hasta llenar la barra (mismo criterio que RSW: con una
 * sola frase la franja se veía vacía a la derecha).
 */
interface Props {
  messages: string[];
  /** false = texto estático centrado, sin scroll. */
  animated?: boolean;
  /** Segundos de una vuelta completa. Si no viene, se deriva de la cantidad de ítems. */
  durationSeconds?: number;
  /** Clases del contenedor (colores por defecto de la barra superior). */
  className?: string;
  style?: CSSProperties;
}

const ITEM_CLS = 'whitespace-nowrap text-[calc(12px_*_var(--font-scale,1))] font-semibold uppercase tracking-[0.5px] md:text-[calc(13px_*_var(--font-scale,1))]';

export function MarqueeStrip({ messages, animated = true, durationSeconds, className, style }: Props) {
  if (messages.length === 0) return null;

  if (!animated) {
    return (
      <div className={`overflow-hidden ${className ?? ''}`} style={style}>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-1 px-6 py-2">
          {messages.map((text, i) => (
            <span key={`${text}-${i}`} className={ITEM_CLS}>
              {text}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const base: string[] = [];
  while (base.length < 6) base.push(...messages);
  const loop = [...base, ...base];

  // Velocidad lenta tipo RSW (~6.5s por ítem visible, mínimo 35s) si el llamador
  // no la fija.
  const durationS = durationSeconds ?? Math.max(Math.round(base.length * 6.5), 35);

  return (
    <div className={`overflow-hidden ${className ?? ''}`} style={style}>
      <div className="py-2">
        <ul className="animate-marquee flex w-max items-center" style={{ animationDuration: `${durationS}s` }}>
          {loop.map((text, i) => (
            <li key={`${text}-${i}`} className={`${ITEM_CLS} pr-12`}>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Parte un textarea de anuncios (una línea = un ítem) en mensajes limpios. */
export function marqueeMessages(raw: string | undefined): string[] {
  return (raw || '')
    .split('\n')
    .map((m) => m.trim())
    .filter(Boolean);
}
