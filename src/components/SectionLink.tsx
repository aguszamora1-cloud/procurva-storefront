import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Link de una sección configurable por el comercio, que puede escribir tanto una
 * ruta de la tienda como una URL de afuera.
 *
 * Una ruta interna tiene que ir por react-router (`Link`): con un `<a href>` la
 * SPA se recarga entera y el visitante pierde el carrito en pantalla y el
 * scroll. Una URL externa, al revés, no puede pasar por el router — quedaría
 * como ruta inexistente y caería en la pantalla de "no encontrado".
 *
 * Todo lo que no arranque con `/` se trata como externo, incluidos `wa.me/…` y
 * los dominios sin protocolo, a los que se les antepone https.
 */
export function SectionLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  const href = to.trim();
  if (!href) return null;

  if (href.startsWith('/')) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }

  const external = /^(https?:|mailto:|tel:)/i.test(href) ? href : `https://${href}`;
  return (
    <a href={external} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
