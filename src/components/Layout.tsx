import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useStore } from '@/context/StoreProvider';
import { AnnouncementBar } from './AnnouncementBar';
import { Navbar } from './Navbar';
import { PromoBanner } from './PromoBanner';
import { NewsletterPopup } from './NewsletterPopup';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';

export function Layout({ children }: { children: ReactNode }) {
  const config = useStore();
  // 'top' (default) → la franja va arriba de todo; 'below_navbar' → debajo del navbar.
  // La franja se auto-oculta si no está activada / no es PRO / el countdown terminó.
  const promoTop = config.promoBanner.position !== 'below_navbar';

  // Medimos la altura real del header sticky y la exponemos como --header-h,
  // para que cualquier elemento sticky de la página (ej: la imagen del detalle
  // de producto) pueda quedar JUSTO debajo del header sin taparse, sin importar
  // el alto del logo / barra de anuncio.
  const headerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setVar = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    setVar();
    const ro = new ResizeObserver(setVar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Franja promo + barra de scroll + navbar quedan fijas juntas arriba. Al ser
          un contenedor sticky ocupan lugar en el flujo, así que el contenido
          scrollea por debajo sin necesidad de spacer/padding-top. */}
      <div ref={headerRef} className="sticky top-0 z-50">
        {promoTop && <PromoBanner />}
        <AnnouncementBar />
        <Navbar />
        {!promoTop && <PromoBanner />}
      </div>
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <NewsletterPopup />
    </div>
  );
}
