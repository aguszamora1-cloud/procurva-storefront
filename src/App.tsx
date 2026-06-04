import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStoreStatus } from '@/context/StoreProvider';
import { CartProvider } from '@/context/CartContext';
import { Layout } from '@/components/Layout';
import { LoadingScreen } from '@/components/LoadingScreen';
import { StoreNotFound } from '@/pages/StoreNotFound';
import { Home } from '@/pages/Home';
import { ProductList } from '@/pages/ProductList';
import { ProductDetail } from '@/pages/ProductDetail';
import { CategoriesIndex } from '@/pages/CategoriesIndex';
import { Category } from '@/pages/Category';
import { Cart } from '@/pages/Cart';

function StoreRoutes() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/productos" element={<ProductList />} />
            <Route path="/producto/:id" element={<ProductDetail />} />
            <Route path="/categorias" element={<CategoriesIndex />} />
            <Route path="/categoria/:name" element={<Category />} />
            <Route path="/carrito" element={<Cart />} />
            <Route path="*" element={<RouteNotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </CartProvider>
  );
}

function RouteNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-3xl">Página no encontrada</h1>
      <Link to="/" className="btn-primary mt-6 inline-block px-8 py-3.5 text-sm">
        Volver al inicio
      </Link>
    </div>
  );
}

function Gate() {
  const { status } = useStoreStatus();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'not-found' || status === 'error') return <StoreNotFound />;
  return <StoreRoutes />;
}

export default function App() {
  return (
    <StoreProvider>
      <Gate />
    </StoreProvider>
  );
}
