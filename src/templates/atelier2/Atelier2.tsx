/**
 * Atelier 2 · A0: esqueleto del kit.
 *
 * Sólo se monta en la vista previa de desarrollo (?pc_dev_tpl=atelier&pc_dev_atelier=2,
 * ver shared/devAtelier2.ts). No está en el registro de plantillas: ninguna tienda
 * puede aplicarlo. Todavía no pinta secciones ni tiene lógica comercial; la
 * composición de v2.1 llega por bloques (A1 a A7) con los componentes que ya
 * usa Atelier 1 (precios, escalones, carrito, extras de Classic).
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import type { TemplateKit } from '../TemplateApp';
import { StoreMark } from '../shared/ui';
import './atelier2.css';

function Atelier2Shell({ children }: { children: ReactNode }) {
  const { name } = useStore();
  return (
    <div className="a2" data-atelier2="a0">
      <header className="a2-h">
        <div className="a2-wrap a2-h__in">
          <Link to="/" className="a2-h__mark" aria-label={`${name}, inicio`}>
            <StoreMark height={32} />
          </Link>
          <nav className="a2-h__nav" aria-label="Principal">
            <Link to="/productos">Productos</Link>
            <Link to="/carrito">Bolsa</Link>
          </nav>
        </div>
      </header>
      <main className="a2-main">{children}</main>
      <footer className="a2-f">
        <div className="a2-wrap">{name}</div>
      </footer>
    </div>
  );
}

function Atelier2Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="a2-wrap a2-notice">
      <h1>{title}</h1>
      {children}
    </section>
  );
}

/** Página provisoria de cada ruta mientras se arma el bloque que le corresponde. */
function pending(title: string, block: string) {
  return function Atelier2Pending() {
    return (
      <Atelier2Notice title={title}>
        <p>Atelier 2 en construcción: esta pantalla llega en el bloque {block}.</p>
      </Atelier2Notice>
    );
  };
}

export const atelier2Kit: TemplateKit = {
  Shell: Atelier2Shell,
  Home: pending('Inicio', 'A2'),
  Catalog: pending('Productos', 'A3'),
  Product: pending('Ficha de producto', 'A4 y A5'),
  Cart: pending('Bolsa', 'A6'),
  Notice: Atelier2Notice,
  fontsHref: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
};
