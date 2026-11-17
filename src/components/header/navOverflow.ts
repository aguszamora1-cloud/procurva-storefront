/**
 * Cuántas entradas de la navegación horizontal entran en `available` px.
 *
 * Si entran todas, todas. Si no, se reserva el lugar del botón "Más" y entran
 * las que quepan delante de él (las primeras: el orden es el del comercio). Un
 * ancho todavía sin medir (0 o negativo) no esconde nada: mejor una barra
 * completa un instante que un "Más" con todo adentro.
 */
export function fitCount(widths: readonly number[], available: number, moreWidth: number, gap: number): number {
  if (!(available > 0)) return widths.length;
  const span = (n: number) => {
    let total = 0;
    for (let i = 0; i < n; i++) total += widths[i];
    return total + gap * Math.max(0, n - 1);
  };
  if (span(widths.length) <= available) return widths.length;
  let n = widths.length - 1;
  while (n > 0 && span(n) + gap + moreWidth > available) n--;
  return n;
}
