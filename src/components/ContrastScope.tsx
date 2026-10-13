import { createContext, useContext, type ReactNode } from 'react';
import { useTypography } from '@/hooks/useTypography';

/**
 * true sólo dentro de un ContrastScope de v2. Es la contraparte en JavaScript
 * del atributo data-ink: lo usan los componentes que arman colores en código
 * (badges, aviso de promo, modal de Outfits) para decidir si aplican los
 * colores con contraste AA. Afuera (carrito, checkout, tiendas v1) vale false
 * y esos componentes pintan exactamente lo de siempre.
 *
 * A diferencia de las variables CSS, el contexto de React SÍ cruza los portales:
 * un modal abierto desde una página del alcance se entera, y pone su propio
 * data-ink para que también le lleguen los tokens.
 */
const ContrastAAContext = createContext(false);

export function useContrastAA(): boolean {
  return useContext(ContrastAAContext);
}

/**
 * Ámbito de los colores con contraste AA de v2 (globals.css, bloques
 * `[data-ink='v2']`). Envuelve las páginas del alcance: home, listado,
 * categorías y ficha.
 *
 * - v1: devuelve los hijos tal cual (Fragment). El DOM es exactamente el de
 *   siempre, sin nodos ni atributos nuevos.
 * - v2: un <div> con `display: contents` y data-ink="v2". `contents` no genera
 *   caja, así que no cambia el layout (ni márgenes, ni sticky, ni grillas); sólo
 *   sirve para que las variables de color hereden hacia adentro.
 *
 * Lo que sale por portal a document.body (visor de fotos, historias, reels)
 * queda FUERA del ámbito: tiene fondos propios oscuros y no usa estos tokens.
 * El modal de Outfits es la excepción: es parte de la compra y se tematiza
 * (pone su propio data-ink cuando useContrastAA() es true).
 */
export function ContrastScope({ children }: { children: ReactNode }) {
  const { version } = useTypography();
  if (version !== 'v2') return <>{children}</>;
  return (
    <ContrastAAContext.Provider value>
      <div data-ink="v2" className="contents">
        {children}
      </div>
    </ContrastAAContext.Provider>
  );
}
