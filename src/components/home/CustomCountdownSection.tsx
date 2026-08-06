import { useEffect, useState } from 'react';
import { SectionLink } from '@/components/SectionLink';
import type { CustomSection, CustomSectionCountdownContent } from '@/lib/types';

/**
 * Cuenta regresiva a una fecha: fin de una promo, lanzamiento, cierre de
 * preventa. Se autooculta cuando vence — una sección que dice "quedan 0d 0h" es
 * peor que no tenerla, y el comercio no siempre vuelve a apagarla a tiempo.
 *
 * Es distinta del PromoCountdown de la ficha, que es una píldora chica al lado
 * del precio: acá es un bloque de ancho completo con los dígitos grandes.
 */

interface Parts {
  d: number;
  h: number;
  m: number;
  s: number;
}

/** Tiempo restante partido en días/horas/minutos/segundos, o null si ya venció. */
function remaining(endIso: string): Parts | null {
  const end = new Date(endIso).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

function Unit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="min-w-[58px] rounded-lg border border-current/20 px-3 py-2 text-center font-heading text-[26px] font-bold leading-none tabular-nums md:min-w-[74px] md:text-[38px]">
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[1.5px] opacity-70 md:text-[11px]">{label}</span>
    </div>
  );
}

export function CustomCountdownSection({ section }: { section: CustomSection }) {
  const c = section.content as CustomSectionCountdownContent;
  const endsAt = c.ends_at || '';
  const [parts, setParts] = useState<Parts | null>(() => (endsAt ? remaining(endsAt) : null));

  useEffect(() => {
    if (!endsAt) return;
    setParts(remaining(endsAt));
    const id = window.setInterval(() => setParts(remaining(endsAt)), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  // Sin fecha o ya vencida: la sección no existe.
  if (!parts) return null;

  const custom = !!(c.background_color || c.text_color);
  const heading = (c.heading || '').trim();
  const subheading = (c.subheading || '').trim();

  return (
    <section
      className={custom ? '' : 'bg-primary text-on-primary'}
      style={custom ? { backgroundColor: c.background_color || undefined, color: c.text_color || undefined } : undefined}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-6 py-10 text-center md:py-14">
        {heading && (
          <h2 className="font-heading text-[24px] font-semibold uppercase leading-[1.1] tracking-[1px] md:text-[34px]">
            {heading}
          </h2>
        )}
        {subheading && <p className="max-w-xl text-[14px] leading-relaxed opacity-80 md:text-[15px]">{subheading}</p>}

        <div className="flex items-start gap-3 md:gap-4">
          {parts.d > 0 && <Unit value={pad(parts.d)} label="Días" />}
          <Unit value={pad(parts.h)} label="Horas" />
          <Unit value={pad(parts.m)} label="Min" />
          <Unit value={pad(parts.s)} label="Seg" />
        </div>

        {c.button_text && c.button_link && (
          <SectionLink
            to={c.button_link}
            className="mt-1 inline-flex items-center border border-current px-8 py-3.5 text-[13px] font-bold uppercase tracking-[0.5px] transition-opacity hover:opacity-75"
          >
            {c.button_text}
          </SectionLink>
        )}
      </div>
    </section>
  );
}
