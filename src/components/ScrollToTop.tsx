import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Al cambiar de ruta, vuelve al tope de la página.
 *
 * Sin esto, al navegar de una página a otra (p. ej. del listado a un producto,
 * o del carrito al checkout) el scroll quedaba en la posición de la página
 * anterior, dando la sensación de que la página "arranca por el medio".
 *
 * Debe renderizarse DENTRO del <BrowserRouter> (usa useLocation).
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}
