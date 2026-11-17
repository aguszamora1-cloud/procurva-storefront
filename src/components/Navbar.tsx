import type { ComponentType } from 'react';
import { useStore } from '@/context/StoreProvider';
import { resolveTemplateHeader, type HeaderLayout } from '@/lib/storeTemplates';
import { HeaderProvider } from './header/HeaderContext';
import { ClassicHeader } from './header/variants/ClassicHeader';

/**
 * Armados de encabezado implementados. Un layout del contrato que todavía no
 * está acá (Inline y Stacked, etapas siguientes) cae en Classic: ninguna tienda
 * se queda sin encabezado por una plantilla adelantada al código. Al agregar un
 * armado, importarlo de forma diferida para que no entre al bundle inicial.
 */
const HEADER_COMPONENTS: Partial<Record<HeaderLayout, ComponentType>> = {
  classic: ClassicHeader,
};

/**
 * Encabezado de la tienda. La lógica (navegación, búsqueda, menú, carrito,
 * sombra al scrollear, fondo propio) vive en header/HeaderContext +
 * header/useHeaderNav; las piezas visuales (HeaderControls, SearchPanel,
 * MenuDrawer, TrackingForm) las comparten las variantes de encabezado, y cada
 * variante (header/variants/*) sólo decide CÓMO componerlas.
 *
 * Qué se pinta lo decide el contrato de plantillas (lib/storeTemplates,
 * resolveTemplateHeader): la referencia ya resuelta de la config → definición
 * del registro → `components.header.layout`. Sin plantilla, referencia que no
 * resuelve, definición inválida o encabezado no admitido: Classic, el de
 * siempre. Con el registro vacío (P0-2), toda tienda ve Classic.
 */
export function Navbar() {
  const config = useStore();
  const Header = HEADER_COMPONENTS[resolveTemplateHeader(config.template)] ?? ClassicHeader;

  return (
    <HeaderProvider>
      <Header />
    </HeaderProvider>
  );
}
