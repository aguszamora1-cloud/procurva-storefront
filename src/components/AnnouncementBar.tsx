import { useStore } from '@/context/StoreProvider';

/**
 * Franja superior con el mensaje del tenant. Fondo accent (color de marca),
 * marquee continuo si top_bar_animated. Réplica del AnnouncementBar de RSW.
 */
export function AnnouncementBar() {
  const config = useStore();
  if (!config.topBarText) return null;

  const text = config.topBarText;

  if (!config.topBarAnimated) {
    return (
      <div className="bg-accent text-on-accent">
        <div className="mx-auto max-w-[1400px] px-4 py-2.5 text-center text-[12px] font-semibold uppercase tracking-[0.5px] md:text-[13px]">
          {text}
        </div>
      </div>
    );
  }

  // Marquee: duplicamos el contenido para loop sin huecos.
  const items = Array.from({ length: 8 });
  return (
    <div className="overflow-hidden bg-accent text-on-accent">
      <div className="py-2.5">
        <ul className="animate-marquee flex w-max items-center gap-12">
          {items.map((_, i) => (
            <li
              key={i}
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
