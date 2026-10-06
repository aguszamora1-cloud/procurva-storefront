/**
 * Etiqueta "Más elegido" de una opción de envío. La prende el comercio por
 * método desde el panel (Ajustes → Logística). Va con el color de la marca.
 */
export function FeaturedShippingTag() {
  return (
    <span className="inline-block rounded-full bg-primary px-2 py-0.5 text-[calc(11px_*_var(--font-scale,1))] font-semibold leading-tight text-on-primary">
      Más elegido
    </span>
  );
}
