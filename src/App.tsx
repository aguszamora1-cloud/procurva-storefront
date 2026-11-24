import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore, useStoreStatus, useStoreType } from '@/context/StoreProvider';
import { WholesalePricingProvider } from '@/context/WholesalePricingContext';
import { PromotionsProvider } from '@/context/PromotionsContext';
import { CategoryTiersProvider } from '@/context/CategoryTiersContext';
import { CartProvider } from '@/context/CartContext';
import { CouponProvider } from '@/context/CouponContext';
import { CartCashRecoveryProvider } from '@/context/CartCashRecovery';
import { FirstPaintProvider, RouteGate, useFirstPaintGate } from '@/context/FirstPaintContext';
import { Layout } from '@/components/Layout';
import { ScrollToTop } from '@/components/ScrollToTop';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ErrorScreen } from '@/components/ErrorScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ContrastScope } from '@/components/ContrastScope';
import { Analytics } from '@/components/Analytics';
import { MetaPixelPageView } from '@/components/MetaPixelPageView';
import { StorefrontAnalytics } from '@/components/StorefrontAnalytics';
import { StoreNotFound } from '@/pages/StoreNotFound';
import { RouteNotFound } from '@/pages/RouteNotFound';
import { WholesalePasswordGate } from '@/pages/WholesalePasswordGate';
import { PaginaEnConstruccion } from '@/pages/PaginaEnConstruccion';
import { devTemplate } from '@/lib/devTemplate';
import { TEMPLATE_APPS_ENABLED, decideTemplateApp, needsOutfitsProbe } from '@/lib/templateApp';
import { useTemplateOutfitsProbe } from '@/hooks/useTemplateOutfitsProbe';

// Code-splitting: cada página se carga bajo demanda (lazy) para reducir el
// bundle inicial. La navegación dispara la descarga del chunk de la página.
const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })));
const ProductList = lazy(() => import('@/pages/ProductList').then((m) => ({ default: m.ProductList })));
const ProductDetail = lazy(() => import('@/pages/ProductDetail').then((m) => ({ default: m.ProductDetail })));
const CategoriesIndex = lazy(() => import('@/pages/CategoriesIndex').then((m) => ({ default: m.CategoriesIndex })));
const Category = lazy(() => import('@/pages/Category').then((m) => ({ default: m.Category })));
const Cart = lazy(() => import('@/pages/Cart').then((m) => ({ default: m.Cart })));
const Checkout = lazy(() => import('@/pages/Checkout').then((m) => ({ default: m.Checkout })));
const CheckoutSuccess = lazy(() => import('@/pages/CheckoutResult').then((m) => ({ default: m.CheckoutSuccess })));
const CheckoutFailure = lazy(() => import('@/pages/CheckoutResult').then((m) => ({ default: m.CheckoutFailure })));
const CheckoutPending = lazy(() => import('@/pages/CheckoutResult').then((m) => ({ default: m.CheckoutPending })));
const CustomPage = lazy(() => import('@/pages/CustomPage').then((m) => ({ default: m.CustomPage })));
const PromoPage = lazy(() => import('@/pages/PromoPage').then((m) => ({ default: m.PromoPage })));
const Resena = lazy(() => import('@/pages/Resena').then((m) => ({ default: m.Resena })));

/**
 * Plantillas P1.1: vista previa de plantillas comerciales SÓLO en vite DEV
 * (`?pc_dev_tpl=`, lib/devTemplate). En producción `import.meta.env.DEV` es
 * `false` literal: el import diferido desaparece del bundle y toda tienda ve
 * Classic, sin cambios.
 */
const TemplateApp = import.meta.env.DEV || TEMPLATE_APPS_ENABLED
  ? lazy(() => import('@/templates/TemplateApp').then((m) => ({ default: m.TemplateApp })))
  : null;

/**
 * T6: plantilla completa activada (o en vista previa autorizada desde el
 * diseñador), sólo con el build habilitado. Todas las condiciones en
 * lib/templateApp; cualquier otra cosa pinta Classic exacto.
 */
function StoreSurface() {
  const config = useStore();
  const storeType = useStoreType();
  const { companyId } = useStoreStatus();
  const gate = {
    enabled: TEMPLATE_APPS_ENABLED,
    template: config.template,
    storeType,
    outfitsSection: config.sections.outfits,
    mostrarOutfit: config.complementaryBlock.mostrarOutfit,
  };
  // Outfits activos: se leen SÓLO si todo lo demás ya da plantilla (ver lib/templateApp).
  const outfits = useTemplateOutfitsProbe(companyId, needsOutfitsProbe(gate));
  const { kit, block } = decideTemplateApp({ ...gate, outfits });
  if (block === 'verificando') return <LoadingScreen />;
  if (TemplateApp && kit)
    return (
      <Suspense fallback={<LoadingScreen />}>
        <TemplateApp id={kit} />
      </Suspense>
    );
  return <StoreRoutes />;
}

/** Fallback liviano mientras se descarga el chunk de la página. */
function PageFallback() {
  // Mientras baja el chunk, la página todavía no montó y por lo tanto no anotó
  // sus bloques: sin esto el gate se abriría sobre una pantalla vacía y la
  // página aparecería después (justo lo que queremos evitar).
  useFirstPaintGate('route-chunk', true);
  return <div className="min-h-[60dvh]" aria-busy="true" />;
}

function StoreRoutes() {
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
        <Analytics />
        <MetaPixelPageView />
        <StorefrontAnalytics />
        <Layout>
          {/* El contenido de la ruta queda retenido hasta que sus bloques estén
              listos; el header y el footer nunca parpadean. */}
          <RouteGate>
          <Suspense fallback={<PageFallback />}>
            {/* ContrastScope: grises AA de v2 sólo en las páginas del alcance
                (home, listado, categorías, ficha). En v1 es un Fragment. */}
            <Routes>
              <Route path="/" element={<ContrastScope><Home /></ContrastScope>} />
              <Route path="/productos" element={<ContrastScope><ProductList /></ContrastScope>} />
              <Route path="/producto/:id" element={<ContrastScope><ProductDetail /></ContrastScope>} />
              <Route path="/categorias" element={<ContrastScope><CategoriesIndex /></ContrastScope>} />
              <Route path="/categoria/:name" element={<ContrastScope><Category /></ContrastScope>} />
              {/* Páginas de texto que publica el comercio (Cambios, FAQ, …). */}
              <Route path="/pagina/:slug" element={<CustomPage />} />
              <Route path="/promo/:slug" element={<ContrastScope><PromoPage /></ContrastScope>} />
              <Route path="/carrito" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/checkout/success" element={<CheckoutSuccess />} />
              <Route path="/checkout/failure" element={<CheckoutFailure />} />
              <Route path="/checkout/pending" element={<CheckoutPending />} />
              {/* Link único de la venta para dejar una reseña verificada. */}
              <Route path="/resena/:token" element={<Resena />} />
              <Route path="*" element={<RouteNotFound />} />
            </Routes>
          </Suspense>
          </RouteGate>
        </Layout>
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

function Gate() {
  const { status, pendingStore } = useStoreStatus();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'not-found') return <StoreNotFound />;
  if (status === 'error') return <ErrorScreen />;
  if (status === 'under-construction')
    return (
      <PaginaEnConstruccion
        nombreEmpresa={pendingStore?.name}
        mensaje={pendingStore?.message}
      />
    );
  if (status === 'needs-password') return <WholesalePasswordGate />;
  if (TemplateApp && devTemplate)
    return (
      <Suspense fallback={<LoadingScreen />}>
        <TemplateApp id={devTemplate} devPreview />
      </Suspense>
    );
  if (TEMPLATE_APPS_ENABLED) return <StoreSurface />;
  return <StoreRoutes />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <Gate />
      </StoreProvider>
    </ErrorBoundary>
  );
}
