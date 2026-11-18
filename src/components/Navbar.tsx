import { type ComponentType, Suspense, lazy } from 'react';
import { useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { resolveHeaderLayout } from '@/lib/headerVariant';
import type { HeaderLayout } from '@/lib/storeTemplates';
import { HeaderProvider } from './header/HeaderContext';
import { ClassicHeader } from './header/variants/ClassicHeader';

/**
 * Inline y Stacked se cargan DIFERIDOS, cada uno en su chunk: sólo los
 * descargan las tiendas cuya plantilla los pide (hoy ninguna: el registro está
 * vacío) y el vite local con `?pc_dev_header=inline|stacked`. Así no entran al
 * bundle inicial de las demás.
 */
const InlineHeader = lazy(() => import('./header/variants/InlineHeader').then((m) => ({ default: m.InlineHeader })));
const StackedHeader = lazy(() => import('./header/variants/StackedHeader').then((m) => ({ default: m.StackedHeader })));

/**
 * Armados de encabezado implementados. Un layout que no esté acá cae en
 * Classic: ninguna tienda se queda sin encabezado por una plantilla adelantada
 * al código. Classic va eager: es el de toda tienda sin plantilla y no puede
 * esperar ningún chunk.
 */
const HEADER_COMPONENTS: Partial<Record<HeaderLayout, ComponentType>> = {
  classic: ClassicHeader,
  inline: InlineHeader,
  stacked: StackedHeader,
};

/**
 * Alto exacto de cada armado diferido (con sus filetes), para el lugar
 * reservado mientras baja su chunk: Inline 60 + 1 / 80 + 1 px; Stacked 60 + 1 /
 * 112 + 52 + 2 px. Si el chunk llegara después de que se destrabe el primer
 * pintado, el contenido no salta al aparecer el encabezado.
 */
const FALLBACK_HEIGHT: Partial<Record<HeaderLayout, string>> = {
  inline: 'h-[61px] lg:h-[81px]',
  stacked: 'h-[61px] lg:h-[166px]',
};

/**
 * Mientras baja el chunk de un armado diferido. Retiene el PRIMER PINTADO con
 * el mismo gate que usan las páginas diferidas (FirstPaintContext): la tienda
 * sigue tapada por la pantalla de carga hasta que el encabezado esté, así no
 * hay barra vacía ni parpadeo. Es un <div> (no un <header>) para que nada
 * confunda el lugar reservado con el encabezado real; mide lo que mide el
 * armado que se está cargando (FALLBACK_HEIGHT).
 */
function HeaderFallback({ layout }: { layout: HeaderLayout }) {
  useFirstPaintGate('header-chunk', true);
  return <div aria-busy="true" className={`${FALLBACK_HEIGHT[layout] ?? ''} bg-background`} />;
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
 * ve Classic; Inline y Stacked sólo se ven en desarrollo con
 * `?pc_dev_header=inline|stacked`.
 */
export function Navbar() {
  const config = useStore();
  const layout = resolveHeaderLayout(config.template);
  const Header = HEADER_COMPONENTS[layout] ?? ClassicHeader;

  return (
    <HeaderProvider>
      <Suspense fallback={<HeaderFallback layout={layout} />}>
        <Header />
      </Suspense>
    </HeaderProvider>
  );
}
