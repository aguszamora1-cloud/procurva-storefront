import { useStore } from '@/context/StoreProvider';

/**
 * Franja superior de anuncios del storefront. Réplica del AnnouncementBar de
 * RSW: fondo del color primario del tenant (negro por defecto), marquee
 * horizontal continuo y lento, padding compacto.
 *
 * El contenido sale EXCLUSIVamente de `catalog_settings.storefront_announcement`
 * (una o varias líneas separadas por salto de línea). Si no está configurado,
 * la barra NO se renderiza — nunca usamos el texto del catálogo mayorista.
 */
export function AnnouncementBar() {
  const config = useStore();

  const messages = config.announcement
    .split('\n')
    .map((m) => m.trim())
    .filter(Boolean);

  if (messages.length === 0) return null;

  // Repetimos los mensajes para llenar la barra (como los 3 beneficios de RSW)
  // y luego duplicamos el track para un loop sin saltos al desplazar -50%.
  const base: string[] = [];
  while (base.length < 6) base.push(...messages);
  const loop = [...base, ...base];

  // Velocidad lenta tipo RSW (~6.5s por ítem visible, mínimo 35s).
  const durationS = Math.max(Math.round(base.length * 6.5), 35);

  return (
    <div className="overflow-hidden bg-primary text-on-primary">
      <div className="py-2">
        <ul className="animate-marquee flex w-max items-center gap-12" style={{ animationDuration: `${durationS}s` }}>
          {loop.map((text, i) => (
            <li
              key={`${text}-${i}`}
              className="whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.5px] md:text-[13px]"
            >
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
