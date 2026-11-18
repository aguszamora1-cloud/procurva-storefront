import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { PreviewBanner } from './PreviewBanner';
import { AnnouncementBar } from './AnnouncementBar';
import { Navbar } from './Navbar';
import { PromoBanner } from './PromoBanner';
import { NewsletterPopup } from './NewsletterPopup';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { FloatingWhatsApp } from './FloatingWhatsApp';

export function Layout({ children }: { children: ReactNode }) {
  const config = useStore();
  // En el checkout ocultamos el botón flotante de WhatsApp: pisa la barra fija de
  // pedido en mobile y compite con el CTA. Ahí el contacto se ofrece como un link
  // discreto en el panel del pedido ("¿Dudas? Escribinos").
  const isCheckout = useLocation().pathname === '/checkout';
  // 'top' (default) → la franja va arriba de todo; 'below_navbar' → debajo del navbar.
  // La franja se auto-oculta si no está activada / no es PRO / el countdown terminó.
  const promoTop = config.promoBanner.position !== 'below_navbar';

  // Medimos la altura real del header sticky y la exponemos como --header-h,
  // para que cualquier elemento sticky de la página (ej: la imagen del detalle
  // de producto) pueda quedar JUSTO debajo del header sin taparse, sin importar
  // el alto del logo / barra de anuncio.
  //
  // Un encabezado puede marcar con `data-sticky-anchor` la fila que queda fija
  // (Stacked: la de navegación). Lo de arriba (franjas y mástil) se va con el
  // scroll: el contenedor se pega con un top negativo de ese alto, en CSS puro
  // (sin escuchar el scroll ni cambiar de alto). --header-h es entonces lo que
  // queda visible pegado. Sin ancla (Classic, Inline) no cambia nada: top 0.
  const headerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setVar = () => {
      const anchor = Array.from(el.querySelectorAll<HTMLElement>('[data-sticky-anchor]')).find(
        (a) => a.getClientRects().length > 0,
      );
      const offset = anchor ? Math.round(anchor.getBoundingClientRect().top - el.getBoundingClientRect().top) : 0;
      if (offset > 0) el.style.top = `-${offset}px`;
      else if (el.style.top) el.style.removeProperty('top');
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight - Math.max(0, offset)}px`);
    };
    setVar();
    const ro = new ResizeObserver(setVar);
    ro.observe(el);
    // P0-2 B4: un encabezado diferido (Inline, Stacked) entra reemplazando a su
    // lugar reservado; si miden lo mismo, el ResizeObserver no avisa y el ancla no
    // se mediría nunca. Sólo hijos directos (el lugar reservado y el encabezado).
    const mo = new MutationObserver(setVar);
    mo.observe(el, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Franja promo + barra de scroll + navbar quedan fijas juntas arriba. Al ser
          un contenedor sticky ocupan lugar en el flujo, así que el contenido
          scrollea por debajo sin necesidad de spacer/padding-top. */}
      <div ref={headerRef} className="sticky top-0 z-50">
        <PreviewBanner />
        {promoTop && <PromoBanner />}
        <AnnouncementBar />
        <Navbar />
        {!promoTop && <PromoBanner />}
      </div>
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      {!isCheckout && <FloatingWhatsApp />}
      <NewsletterPopup />
    </div>
  );
}
