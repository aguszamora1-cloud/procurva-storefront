import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStoreStatus } from '@/context/StoreProvider';
import { WholesalePricingProvider } from '@/context/WholesalePricingContext';
import { PromotionsProvider } from '@/context/PromotionsContext';
import { CategoryTiersProvider } from '@/context/CategoryTiersContext';
import { CartProvider } from '@/context/CartContext';
import { CouponProvider } from '@/context/CouponContext';
import { FirstPaintProvider, RouteGate, useFirstPaintGate } from '@/context/FirstPaintContext';
import { Layout } from '@/components/Layout';
import { ScrollToTop } from '@/components/ScrollToTop';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ErrorScreen } from '@/components/ErrorScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Analytics } from '@/components/Analytics';
import { MetaPixelPageView } from '@/components/MetaPixelPageView';
import { StorefrontAnalytics } from '@/components/StorefrontAnalytics';
import { StoreNotFound } from '@/pages/StoreNotFound';
import { RouteNotFound } from '@/pages/RouteNotFound';
import { WholesalePasswordGate } from '@/pages/WholesalePasswordGate';
import { PaginaEnConstruccion } from '@/pages/PaginaEnConstruccion';

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

/** Fallback liviano mientras se descarga el chunk de la página. */
function PageFallback() {
  // Mientras baja el chunk, la página todavía no montó y por lo tanto no anotó
  // sus bloques: sin esto el gate se abriría sobre una pantalla vacía y la
  // página aparecería después (justo lo que queremos evitar).
  useFirstPaintGate('route-chunk', true);
  return <div className="min-h-[60vh]" aria-busy="true" />;
}

function StoreRoutes() {
  return (
    <CartProvider>
      <CouponProvider>
      <WholesalePricingProvider>
      <PromotionsProvider>
      <CategoryTiersProvider>
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
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/productos" element={<ProductList />} />
              <Route path="/producto/:id" element={<ProductDetail />} />
              <Route path="/categorias" element={<CategoriesIndex />} />
              <Route path="/categoria/:name" element={<Category />} />
              {/* Páginas de texto que publica el comercio (Cambios, FAQ, …). */}
              <Route path="/pagina/:slug" element={<CustomPage />} />
              <Route path="/carrito" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/checkout/success" element={<CheckoutSuccess />} />
              <Route path="/checkout/failure" element={<CheckoutFailure />} />
              <Route path="/checkout/pending" element={<CheckoutPending />} />
              <Route path="*" element={<RouteNotFound />} />
            </Routes>
          </Suspense>
          </RouteGate>
        </Layout>
      </FirstPaintProvider>
      </BrowserRouter>
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
