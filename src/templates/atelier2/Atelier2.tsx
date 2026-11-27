/**
 * Atelier 2 (referencia visual: maqueta Atelier v2.1 aprobada).
 *
 * Sólo se monta en la vista previa de desarrollo (?pc_dev_tpl=atelier&pc_dev_atelier=2,
 * ver shared/devAtelier2.ts). No está en el registro de plantillas: ninguna tienda
 * puede aplicarlo.
 *
 * Estado por bloques:
 *   A0  esqueleto del kit.
 *   A1  base visual (Chrome.tsx): encabezado, menú de celular, buscador, pie,
 *       paleta del comercio legible (palette.ts) e Inter.
 *   A2  inicio (Home.tsx, Hero.tsx, Card.tsx): portada a ancho completo y
 *       secciones con la visibilidad y el orden del editor.
 *   A3  catálogo (Catalog.tsx): categoría, búsqueda, talle, orden y «Mostrar más».
 *   A4  ficha (Product.tsx, Choices.tsx): compra normal y escalones «Lleva N».
 *   A6  bolsa (Cart.tsx): bolsa lateral y página /carrito.
 * Sin lógica comercial propia: todo sale de los hooks compartidos.
 */

import type { ReactNode } from 'react';
import type { TemplateKit } from '../TemplateApp';
import { Atelier2Shell } from './Chrome';
import { Atelier2Home } from './Home';
import { Atelier2Catalog } from './Catalog';
import { Atelier2Product } from './Product';
import { Atelier2CartPage } from './Cart';
import './atelier2.css';

function Atelier2Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="a2-wrap a2-notice">
      <h1>{title}</h1>
      {children}
    </section>
  );
}

export const atelier2Kit: TemplateKit = {
  Shell: Atelier2Shell,
  Home: Atelier2Home,
  Catalog: Atelier2Catalog,
  Product: Atelier2Product,
  Cart: Atelier2CartPage,
  Notice: Atelier2Notice,
  fontsHref: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
};
