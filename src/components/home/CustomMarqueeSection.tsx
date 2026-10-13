import { MarqueeStrip, marqueeMessages } from '@/components/MarqueeStrip';
import type { CustomSection, CustomSectionMarqueeContent } from '@/lib/types';
import { useInk } from '@/hooks/useInk';

/**
 * Barra de anuncios como sección del home: la misma franja de la barra superior,
 * pero ubicable donde el comercio quiera (debajo del banner, entre secciones) y
 * repetible tantas veces como agregue.
 *
 * Sin colores configurados cae al primario del tenant, igual que la barra
 * superior: así una barra recién creada ya se ve como la de arriba y el comercio
 * sólo toca los colores si quiere diferenciarla.
 */
export function CustomMarqueeSection({ section }: { section: CustomSection }) {
  const c = section.content as CustomSectionMarqueeContent;
  // v2 dentro del ámbito (C2): si el comercio eligió fondo Y texto y no llegan a
  // 4,5:1 (ej. blanco sobre #ff0000: 3,99), se ajusta lo mínimo el fondo o, si
  // cambiaría demasiado, el texto. Afuera, sus colores tal cual.
  const ink = useInk();
  const messages = marqueeMessages(c.messages);
  if (messages.length === 0) return null;

  const custom = !!(c.background_color || c.text_color);
  const pair = c.background_color && c.text_color ? ink.fill(c.background_color, c.text_color) : null;
  const speed = typeof c.speed_seconds === 'number' && c.speed_seconds > 0 ? c.speed_seconds : 35;

  return (
    <MarqueeStrip
      messages={messages}
      animated={c.animated !== false}
      durationSeconds={speed}
      className={custom ? undefined : 'bg-primary text-on-primary'}
      style={
        custom
          ? ink.aa && pair
            ? { backgroundColor: pair.fill, color: pair.text }
            : { backgroundColor: c.background_color || undefined, color: c.text_color || undefined }
          : undefined
      }
    />
  );
}
