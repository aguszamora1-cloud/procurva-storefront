import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { logoLayout, measureLogo, parseCssColor, type LogoMetrics, type LogoSlot } from './logoMetrics';

/** Si la medición tarda más que esto, se muestra en modo estricto (no se deja el logo oculto). */
const MEASURE_TIMEOUT_MS = 1500;

/** Primer fondo opaco hacia arriba desde `el` (el del encabezado, con su fondo propio si lo tiene). */
function headerBackground(el: HTMLElement | null): [number, number, number] | null {
  for (let n = el; n; n = n.parentElement) {
    const rgb = parseCssColor(getComputedStyle(n).backgroundColor);
    if (rgb) return rgb;
  }
  return null;
}

/**
 * Logo del encabezado Inline con tamaño según su contenido visible
 * (header/logoMetrics). Sólo lo usa Inline: Classic sigue con su <img> de siempre.
 *
 * - optical: el archivo entero escalado, con el contenido en la caja del logo.
 *   La caja recorta (overflow hidden) sólo fondo comprobado: transparente, o un
 *   color sólido igual al fondo del encabezado. La caja nunca sale de la barra.
 * - strict: el archivo entero con tope de alto, como antes (CORS, error, fondo
 *   ambiguo o color distinto al del encabezado).
 * - Sin logo: el nombre de la tienda en texto.
 *
 * La imagen no recibe eventos: el link es la caja visible, así un margen
 * transparente nunca "atrapa" un clic dirigido a otra cosa.
 */
export function OpticalLogo({ slot, strictH, className = '' }: { slot: LogoSlot; strictH: number; className?: string }) {
  const config = useStore();
  const url = config.logoUrl;
  const ref = useRef<HTMLAnchorElement>(null);
  const [state, setState] = useState<{ url: string; metrics: LogoMetrics | null; headerRgb: [number, number, number] | null } | null>(null);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    // Vencido el tope, el logo queda estricto en esta instancia: un resultado
    // tardío no vuelve a cambiarle el tamaño a la vista.
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      if (alive) setState((s) => (s?.url === url ? s : { url, metrics: null, headerRgb: null }));
    }, MEASURE_TIMEOUT_MS);
    measureLogo(url).then((metrics) => {
      if (!alive || timedOut) return;
      window.clearTimeout(timer);
      setState({ url, metrics, headerRgb: headerBackground(ref.current?.parentElement ?? null) });
    });
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [url]);

  const focus =
    'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-current';

  if (!url) {
    return (
      <Link ref={ref} to="/" aria-label={config.name} className={`flex min-w-0 items-center ${focus} ${className}`}>
        <span className="truncate font-heading text-[calc(17px_*_var(--font-scale,1))] font-semibold uppercase tracking-[0.16em] text-on-surface">
          {config.name}
        </span>
      </Link>
    );
  }

  const ready = state?.url === url;
  const layout = logoLayout(ready ? state.metrics : null, slot, ready ? state.headerRgb : null, strictH);
  const optical = ready && layout.mode === 'optical';

  // Un único <img> desde el primer render: al pasar de "pending" a su modo sólo
  // cambian los estilos. Un nodo nuevo volvería a descargar el archivo entero,
  // porque el almacenamiento responde "no-cache". Fuera del modo óptico la caja
  // es "display: contents" y el <img> queda como hijo directo del link, igual que antes.
  return (
    <Link
      ref={ref}
      to="/"
      aria-label={config.name}
      data-logo-mode={ready ? layout.mode : 'pending'}
      className={`flex min-w-0 items-center ${focus} ${className}`}
      // Mientras mide: el lugar reservado (alto máximo de la caja) y el logo invisible.
      style={ready ? undefined : { minHeight: slot.maxH, visibility: 'hidden' }}
    >
      <span
        className={optical ? 'relative block shrink-0 overflow-hidden' : 'contents'}
        style={optical ? { width: layout.boxW, height: layout.boxH } : undefined}
      >
        <img
          src={url}
          alt={config.name}
          className={
            optical
              ? 'pointer-events-none absolute max-w-none select-none'
              : 'w-auto max-w-full object-contain object-left'
          }
          style={
            optical
              ? { width: layout.imgW, height: layout.imgH, left: layout.left, top: layout.top }
              : { height: layout.mode === 'strict' ? layout.imgH : slot.strictMaxH }
          }
          loading="eager"
          draggable={optical ? false : undefined}
        />
      </span>
    </Link>
  );
}
