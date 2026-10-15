import { useEffect, useState, type RefObject } from 'react';

/**
 * ¿Entran estas etiquetas completas en el <select> con el ancho que le deja su
 * contenedor? Un select nativo no acorta ni parte el texto: si la opción más
 * ancha no cabe, se corta al elegirla. Con fuentes anchas (Poppins) y la escala
 * «Más grande» (1,3) pasa en teléfonos de 320 px. En vez de achicar la letra,
 * el que llama elige etiquetas más cortas cuando esto devuelve `false`.
 *
 * Se mide con la fuente real del select (canvas) contra el ancho del contenedor
 * (no contra el ancho actual del select, que ya cambia con las etiquetas que
 * tenga puestas: así no oscila). Se vuelve a medir al cambiar el ancho del
 * contenedor, al cargar las fuentes y si cambia el estilo del <html> (ahí vive
 * `--font-scale`).
 */
export function useSelectFits(ref: RefObject<HTMLSelectElement | null>, labels: string[], enabled = true): boolean {
  const [fits, setFits] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    const box = el?.parentElement?.parentElement;
    if (!el || !box) return;

    const measure = () => {
      const cs = getComputedStyle(el);
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return;
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const widest = Math.max(0, ...labels.map((l) => ctx.measureText(l).width));
      // Lo que el select necesita: texto + relleno + la flecha nativa (~20px).
      const needed = widest + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + 20;
      setFits(needed <= box.clientWidth);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    const mo = new MutationObserver(measure);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [ref, enabled, labels.join('\u0000')]); // eslint-disable-line react-hooks/exhaustive-deps

  return fits;
}
