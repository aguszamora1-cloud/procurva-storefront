import { Suspense, lazy, useEffect, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { WholesalePricingProvider } from '@/context/WholesalePricingContext';
import { PromotionsProvider } from '@/context/PromotionsContext';
import { CategoryTiersProvider } from '@/context/CategoryTiersContext';
import { CartProvider } from '@/context/CartContext';
import { CouponProvider } from '@/context/CouponContext';
import { CartCashRecoveryProvider } from '@/context/CartCashRecovery';
import { FirstPaintProvider } from '@/context/FirstPaintContext';
import { ScrollToTop } from '@/components/ScrollToTop';
import { ContrastScope } from '@/components/ContrastScope';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Analytics } from '@/components/Analytics';
import { MetaPixelPageView } from '@/components/MetaPixelPageView';
import { StorefrontAnalytics } from '@/components/StorefrontAnalytics';
import { useStoreType } from '@/context/StoreProvider';
import type { DevTemplateId } from '@/lib/devTemplate';
import { PreviewSwitcher } from './shared/PreviewSwitcher';
import './shared/shared.css';

/**
 * Vista previa de plantillas comerciales (P1.1, sólo vite DEV).
 *
 * Reemplaza el armado de Classic (Layout + páginas) por el de la plantilla
 * elegida, con los MISMOS proveedores de datos (carrito, cupones, promos,
 * precios mayoristas, escalones).
 *
 * T4: la misma analítica que Classic, montada una sola vez y en el mismo lugar
 * (Analytics, MetaPixelPageView, StorefrontAnalytics). Las fichas de los kits
 * disparan ViewContent, AddToCart y product_view con los mismos hooks
 * (shared/commerce.ts); el carrito, el checkout y sus resultados son los de
 * Classic. En las vistas previas no sale nada: en la del diseñador isPreviewMode
 * apaga el píxel, el CAPI y el embudo (y la guarda de templatePreviewGuard corta
 * toda escritura); en la de desarrollo la analítica directamente no se monta
 * (el píxel se carga por GET, que la guarda deja pasar) y la guarda corta el resto.
 *
 * T3: el checkout, sus resultados (aprobado, rechazado, pendiente), la página de
 * una promo y la reseña son las MISMAS páginas de Classic, montadas sobre una
 * superficie Classic (sus colores, que ya tienen el contraste resuelto) con la
 * tipografía de la plantilla, y con el encabezado y el pie de la plantilla
 * alrededor. Ninguna lógica comercial se duplica. En la vista previa de
 * desarrollo (?pc_dev_tpl) el checkout se abre, pero lib/devTemplate corta el
 * pedido y el pago (no se crea nada); en la del diseñador lo corta previewGuard.
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
const ClassicCheckout = lazy(() => import('@/pages/Checkout').then((m) => ({ default: m.Checkout })));
const ClassicCheckoutSuccess = lazy(() => import('@/pages/CheckoutResult').then((m) => ({ default: m.CheckoutSuccess })));
const ClassicCheckoutFailure = lazy(() => import('@/pages/CheckoutResult').then((m) => ({ default: m.CheckoutFailure })));
const ClassicCheckoutPending = lazy(() => import('@/pages/CheckoutResult').then((m) => ({ default: m.CheckoutPending })));
const ClassicPromoPage = lazy(() => import('@/pages/PromoPage').then((m) => ({ default: m.PromoPage })));
const ClassicResena = lazy(() => import('@/pages/Resena').then((m) => ({ default: m.Resena })));

/**
 * Página de Classic dentro de la plantilla. `contrast` = la misma decisión que
 * App.tsx: ContrastScope sólo donde Classic lo usa (ficha, promo); el checkout,
 * sus resultados y la reseña van sin él, igual que en Classic.
 */
function ClassicSurface({ children, contrast = false }: { children: ReactNode; contrast?: boolean }) {
  return <div className="tpl-classic-surface">{contrast ? <ContrastScope>{children}</ContrastScope> : children}</div>;
}

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
          <Route path="/producto/:id" element={
              isWholesale ? (
                // Superficie propia de Classic: sobre el fondo oscuro de una plantilla su texto no se leía.
                <ClassicSurface contrast>
                  <ClassicProductDetail />
                </ClassicSurface>
              ) : (
                <Product />
              )
            } />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/pagina/:slug" element={<ClassicCustomPage />} />
          {/* T3: mismas rutas y mismas páginas que Classic (App.tsx). */}
          <Route path="/promo/:slug" element={<ClassicSurface contrast><ClassicPromoPage /></ClassicSurface>} />
          <Route path="/checkout" element={<ClassicSurface><ClassicCheckout /></ClassicSurface>} />
          <Route path="/checkout/success" element={<ClassicSurface><ClassicCheckoutSuccess /></ClassicSurface>} />
          <Route path="/checkout/failure" element={<ClassicSurface><ClassicCheckoutFailure /></ClassicSurface>} />
          <Route path="/checkout/pending" element={<ClassicSurface><ClassicCheckoutPending /></ClassicSurface>} />
          <Route path="/resena/:token" element={<ClassicSurface><ClassicResena /></ClassicSurface>} />
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

/**
 * `devPreview`: vista previa de desarrollo (?pc_dev_tpl): suma el selector de
 * plantillas y no monta analítica. En una tienda con la plantilla activada es
 * false: selector afuera y la misma analítica que Classic.
 */
export function TemplateApp({ id, devPreview = false }: { id: DevTemplateId; devPreview?: boolean }) {
  const Kit = KITS[id];
  return (
    <CartProvider>
      <CouponProvider>
        <WholesalePricingProvider>
          <PromotionsProvider>
            <CategoryTiersProvider>
              <CartCashRecoveryProvider>
                <BrowserRouter>
                  <FirstPaintProvider>
                    <ScrollToTop />
                    {/* La vista previa de desarrollo mira una tienda REAL: sin
                        analítica, para no cargar su píxel ni contar visitas. */}
                    {!devPreview && (
                      <>
                        <Analytics />
                        <MetaPixelPageView />
                        <StorefrontAnalytics />
                      </>
                    )}
                    <Suspense fallback={<LoadingScreen />}>
                      <Kit />
                    </Suspense>
                    {import.meta.env.DEV && devPreview && <PreviewSwitcher current={id} />}
                  </FirstPaintProvider>
                </BrowserRouter>
              </CartCashRecoveryProvider>
            </CategoryTiersProvider>
          </PromotionsProvider>
        </WholesalePricingProvider>
      </CouponProvider>
    </CartProvider>
  );
}
