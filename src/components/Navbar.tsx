import { type ComponentType, Suspense, lazy } from 'react';
import { useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { resolveHeaderLayout } from '@/lib/headerVariant';
import type { HeaderLayout } from '@/lib/storeTemplates';
import { HeaderProvider } from './header/HeaderContext';
import { ClassicHeader } from './header/variants/ClassicHeader';

/**
 * Inline se carga DIFERIDO: sólo lo descargan las tiendas cuya plantilla lo
 * pide (hoy ninguna: el registro está vacío) y el vite local con
 * `?pc_dev_header=inline`. Así no entra al bundle inicial de las demás.
 */
const InlineHeader = lazy(() => import('./header/variants/InlineHeader').then((m) => ({ default: m.InlineHeader })));

/**
 * Armados de encabezado implementados. Un layout del contrato que todavía no
 * está acá (Stacked, etapa siguiente) cae en Classic: ninguna tienda se queda
 * sin encabezado por una plantilla adelantada al código. Classic va eager: es
 * el de toda tienda sin plantilla y no puede esperar ningún chunk.
 */
const HEADER_COMPONENTS: Partial<Record<HeaderLayout, ComponentType>> = {
  classic: ClassicHeader,
  inline: InlineHeader,
};

/**
 * Mientras baja el chunk de un armado diferido. Retiene el PRIMER PINTADO con
 * el mismo gate que usan las páginas diferidas (FirstPaintContext): la tienda
 * sigue tapada por la pantalla de carga hasta que el encabezado esté, así no
 * hay barra vacía ni parpadeo. Es un <div> (no un <header>) para que nada
 * confunda el lugar reservado con el encabezado real; mide lo que mide la
 * barra de Inline (60 px en teléfono y tablet, 80 px en escritorio).
 */
function HeaderFallback() {
  useFirstPaintGate('header-chunk', true);
  return <div aria-busy="true" className="h-[60px] border-b border-line bg-background lg:h-20" />;
}

/**
 * Encabezado de la tienda. La lógica (navegación, búsqueda, menú, carrito,
 * sombra al scrollear, fondo propio) vive en header/HeaderContext +
 * header/useHeaderNav; las piezas visuales (HeaderControls, SearchPanel,
 * MenuDrawer, TrackingForm, DesktopNav, InlineMenuSheet, OpticalLogo) las
 * comparten las variantes de encabezado, y cada variante (header/variants/*)
 * sólo decide CÓMO componerlas.
 *
 * Qué se pinta lo decide el contrato de plantillas (lib/storeTemplates,
 * resolveTemplateHeader, vía lib/headerVariant): la referencia ya resuelta de la
 * config → definición del registro → `components.header.layout`. Sin
 * plantilla, referencia que no resuelve, definición inválida o encabezado no
 * admitido: Classic, el de siempre. Con el registro vacío (P0-2), toda tienda
 * ve Classic; Inline sólo se ve en desarrollo con `?pc_dev_header=inline`.
 */
export function Navbar() {
  const config = useStore();
  const Header = HEADER_COMPONENTS[resolveHeaderLayout(config.template)] ?? ClassicHeader;

  return (
    <HeaderProvider>
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
    </HeaderProvider>
  );
}
