import { HeaderProvider } from './header/HeaderContext';
import { ClassicHeader } from './header/variants/ClassicHeader';

/**
 * Encabezado de la tienda. La lógica (navegación, búsqueda, menú, carrito,
 * sombra al scrollear, fondo propio) vive en header/HeaderContext +
 * header/useHeaderNav; las piezas visuales (HeaderControls, SearchPanel,
 * MenuDrawer, TrackingForm) las comparten las variantes de encabezado, y cada
 * variante (header/variants/*) sólo decide CÓMO componerlas.
 *
 * P0-2 B1: este componente es el despachador, pero todavía elige SIEMPRE Classic
 * (el encabezado de siempre, HTML idéntico al anterior a la separación). La
 * elección por plantilla llega en una etapa posterior, con su contrato.
 */
export function Navbar() {
  return (
    <HeaderProvider>
      <ClassicHeader />
    </HeaderProvider>
  );
}
