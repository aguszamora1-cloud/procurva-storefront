import { useHeader } from '../HeaderContext';
import { CartButton, HeaderLogo, MenuButton, SearchButton } from '../HeaderControls';
import { MenuDrawer } from '../MenuDrawer';
import { SearchPanel } from '../SearchPanel';

/**
 * Encabezado Classic: el de siempre. Tres columnas (menú y búsqueda / logo
 * centrado / carrito), búsqueda desplegable y toda la navegación en el menú
 * lateral, en mobile y en escritorio. Es el que ven todas las tiendas sin
 * plantilla: su HTML tiene que quedar idéntico (e2e/store-templates/header.spec.ts).
 */
export function ClassicHeader() {
  const { scrolled, headerVars } = useHeader();

  return (
    <header
      className={`border-b border-line bg-background transition-shadow duration-200 ${
        scrolled ? 'shadow-md' : ''
      }`}
    >
      {/* El fondo propio va en la barra y en la búsqueda, NO en el <header>: el
          drawer del menú vive adentro y tiene que seguir con los colores de la página. */}
      <div
        style={headerVars}
        className="mx-auto grid max-w-none grid-cols-3 items-center gap-2 bg-background px-4 py-3 md:px-6"
      >
        {/* Izquierda: hamburguesa + búsqueda (desktop + mobile) */}
        <div className="flex items-center justify-start gap-1">
          <MenuButton />
          <SearchButton />
        </div>

        {/* Centro: logo */}
        <HeaderLogo />

        {/* Derecha: carrito */}
        <div className="flex items-center justify-end gap-3 md:gap-6">
          <CartButton />
        </div>
      </div>

      {/* Barra de búsqueda desplegable (debajo del top bar, ancho completo) */}
      <SearchPanel />

      <MenuDrawer />
    </header>
  );
}
