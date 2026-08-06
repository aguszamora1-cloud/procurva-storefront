import { useStore } from '@/context/StoreProvider';
import { MarqueeStrip, marqueeMessages } from '@/components/MarqueeStrip';

/**
 * Franja superior de anuncios del storefront. Réplica del AnnouncementBar de
 * RSW: fondo del color primario del tenant (negro por defecto), marquee
 * horizontal continuo y lento, padding compacto.
 *
 * El contenido lo resuelve storeConfig con precedencia: `storefront_announcement`
 * (una o varias líneas separadas por salto de línea) y, si está vacío,
 * `top_bar_text`. Si no hay ninguno de los dos, la barra NO se renderiza.
 *
 * El texto llega acá ya resuelto en `config.announcement` a propósito: la barra
 * no tiene que saber de qué campo salió, así uniforma el estilo (mayúsculas +
 * marquee) venga de donde venga.
 *
 * El render lo pone MarqueeStrip, compartido con las barras de anuncios que el
 * comercio agrega como sección en cualquier posición del home.
 */
export function AnnouncementBar() {
  const config = useStore();

  return (
    // Siempre animada: `top_bar_animated` nace en false y esta barra scrollea
    // desde siempre, así que atarla a ese flag frenaría la franja de casi todas
    // las tiendas. Quien quiera una barra estática usa la sección de anuncios.
    <MarqueeStrip messages={marqueeMessages(config.announcement)} className="bg-primary text-on-primary" />
  );
}
