import { Suspense, lazy, useEffect, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { WholesalePricingProvider } from '@/context/WholesalePricingContext';
import { PromotionsProvider } from '@/context/PromotionsContext';
import { CategoryTiersProvider } from '@/context/CategoryTiersContext';
import { CartProvider } from '@/context/CartContext';
import { CouponProvider } from '@/context/CouponContext';
import { FirstPaintProvider } from '@/context/FirstPaintContext';
import { ScrollToTop } from '@/components/ScrollToTop';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useStoreType } from '@/context/StoreProvider';
import type { DevTemplateId } from '@/lib/devTemplate';
import { PreviewSwitcher } from './shared/PreviewSwitcher';
import './shared/shared.css';

/**
 * Vista previa de plantillas comerciales (P1.1, sólo vite DEV).
 *
 * Reemplaza el armado de Classic (Layout + páginas) por el de la plantilla
 * elegida, con los MISMOS proveedores de datos (carrito, cupones, promos,
 * precios mayoristas, escalones). No monta analítica, píxeles ni popups: la
 * vista previa no registra nada (además, lib/devTemplate corta toda escritura).
 * El checkout no se abre: la vista previa termina en el carrito.
 */
export interface TemplateKit {
  /** Encabezado + pie + carrito lateral alrededor de la página. */
  Shell: ComponentType<{ children: ReactNode }>;
  Home: ComponentType;
  Catalog: ComponentType;
  Product: ComponentType;
  Cart: ComponentType;
  /** Página simple con título y texto (checkout deshabilitado, no encontrado). */
  Notice: ComponentType<{ title: string; children?: ReactNode }>;
  fontsHref: string;
}

const KITS: Record<DevTemplateId, ComponentType> = {
  atelier: lazy(() => import('./atelier/Atelier').then((m) => ({ default: () => <KitRoutes kit={m.atelierKit} id="atelier" /> }))),
  distrito: lazy(() => import('./distrito/Distrito').then((m) => ({ default: () => <KitRoutes kit={m.distritoKit} id="distrito" /> }))),
  momentum: lazy(() => import('./momentum/Momentum').then((m) => ({ default: () => <KitRoutes kit={m.momentumKit} id="momentum" /> }))),
};

const ClassicCustomPage = lazy(() => import('@/pages/CustomPage').then((m) => ({ default: m.CustomPage })));
const ClassicProductDetail = lazy(() => import('@/pages/ProductDetail').then((m) => ({ default: m.ProductDetail })));

function useFonts(href: string) {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.tplFonts = '';
    document.head.appendChild(link);
    return () => link.remove();
  }, [href]);
}

function KitRoutes({ kit, id }: { kit: TemplateKit; id: DevTemplateId }) {
  useFonts(kit.fontsHref);
  const isWholesale = useStoreType() === 'wholesale';
  const { Shell, Home, Catalog, Product, Cart, Notice } = kit;
  useEffect(() => {
    document.documentElement.dataset.tplPreview = id;
    return () => {
      delete document.documentElement.dataset.tplPreview;
    };
  }, [id]);
  return (
    <Shell>
      <Suspense fallback={<div className="tpl-route-wait" aria-busy="true" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/productos" element={<Catalog />} />
          <Route path="/categorias" element={<Catalog />} />
          <Route path="/categoria/:name" element={<Catalog />} />
          {/* Mayorista: curvas, packs y escalones viven en la ficha de Classic. */}
          <Route path="/producto/:id" element={isWholesale ? <ClassicProductDetail /> : <Product />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/pagina/:slug" element={<ClassicCustomPage />} />
          <Route
            path="/checkout/*"
            element={
              <Notice title="Checkout fuera de la vista previa">
                <p>Esta es una vista previa de la plantilla. El pago no se abre desde acá y no se crea ningún pedido.</p>
                <p>
                  <Link to="/carrito">Volver al carrito</Link>
                </p>
              </Notice>
            }
          />
          <Route
            path="*"
            element={
              <Notice title="No encontramos esta página">
                <p>
                  <Link to="/">Ir al inicio</Link>
                </p>
              </Notice>
            }
          />
        </Routes>
      </Suspense>
    </Shell>
  );
}

export function TemplateApp({ id }: { id: DevTemplateId }) {
  const Kit = KITS[id];
  return (
    <CartProvider>
      <CouponProvider>
        <WholesalePricingProvider>
          <PromotionsProvider>
            <CategoryTiersProvider>
              <BrowserRouter>
                <FirstPaintProvider>
                  <ScrollToTop />
                  <Suspense fallback={<LoadingScreen />}>
                    <Kit />
                  </Suspense>
                  <PreviewSwitcher current={id} />
                </FirstPaintProvider>
              </BrowserRouter>
            </CategoryTiersProvider>
          </PromotionsProvider>
        </WholesalePricingProvider>
      </CouponProvider>
    </CartProvider>
  );
}
