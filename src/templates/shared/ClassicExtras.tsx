/**
 * Piezas comerciales de Classic dentro de las plantillas (cierre visual, 24/11).
 *
 * Se montan los MISMOS componentes de Classic, sin copiar su lógica: el botón de
 * WhatsApp (FloatingWhatsApp), la calculadora de envío (ShippingCalculator), «Así
 * funciona tu compra» (PurchaseFlow), las reseñas de la ficha (ProductReviews) y
 * el aviso de ahorro por cantidad del carrito (nudges de useCartPromos). Cada uno
 * se muestra con las mismas condiciones que en Classic (configuración del
 * comercio, plan, diseño de la ficha) y dentro de StoreSurface, así que toma la
 * paleta y la tipografía de la plantilla. Ninguna consulta, evento ni regla nueva.
 */
import { useLocation } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { useCartPromos } from '@/hooks/useCartPromos';
import { FloatingWhatsApp } from '@/components/FloatingWhatsApp';
import { ShippingCalculator } from '@/components/ShippingCalculator';
import { PurchaseFlow } from '@/components/PurchaseFlow';
import { ProductReviews } from '@/components/ProductReviews';
import { resolveProductLayoutOrNull } from '@/lib/productLayout';
import type { Product, StoreConfig } from '@/lib/types';
import { StoreSurface, type TemplateInk } from './StoreContent';

/**
 * Botón flotante de WhatsApp: igual que Layout de Classic, en toda la tienda
 * menos en /checkout, y sólo si el comercio cargó su número (el componente se
 * oculta solo). La altura se corre por CSS (shared.css) para no tapar las barras
 * fijas de cada plantilla en el celular.
 */
export function TemplateWhatsApp() {
  const isCheckout = useLocation().pathname === '/checkout';
  if (isCheckout) return null;
  return (
    <div className="tpl-wa">
      <FloatingWhatsApp />
    </div>
  );
}

/** Mismo criterio que la ficha de Classic: ¿el comercio dejó este bloque en su diseño de ficha? */
function layoutShows(product: Product, config: StoreConfig, token: string): boolean {
  const layout = resolveProductLayoutOrNull(product.product_layout) ?? config.productLayout;
  if (!layout) return true;
  return layout.right_column.includes(token) || layout.below_product.includes(token);
}

/**
 * Columna de compra: calculadora de envío y «Así funciona tu compra», en el mismo
 * orden que Classic. Cada uno se autooculta con la misma condición que allá.
 */
export function TemplatePdpExtras({ ink, product }: { ink: TemplateInk; product: Product }) {
  const config = useStore();
  const shipping = config.showShippingCalculator !== false;
  const flow = config.purchaseFlowEnabled && config.purchaseFlowSteps.length > 0 && layoutShows(product, config, 'purchase_flow');
  if (!shipping && !flow) return null;
  return (
    <StoreSurface ink={ink}>
      <div className="tpl-pdp-extras">
        {shipping && <ShippingCalculator productId={product.id} />}
        {flow && <PurchaseFlow />}
      </div>
    </StoreSurface>
  );
}

/** Reseñas de la ficha (Extra PRO), con la misma condición que Classic. El componente se oculta si no hay reseñas. */
export function TemplatePdpReviews({ ink, product }: { ink: TemplateInk; product: Product }) {
  const config = useStore();
  if (!config.isPro || !config.sections.productReviews || !layoutShows(product, config, 'reviews')) return null;
  return (
    <StoreSurface ink={ink}>
      <div className="tpl-pdp-reviews">
        <ProductReviews productId={product.id} display={config.reviewsDisplayMode ?? undefined} />
      </div>
    </StoreSurface>
  );
}

/**
 * «Agregá N más y ahorrá — …»: las promos por cantidad a las que les falta poco,
 * las mismas que muestra el carrito de Classic (useCartPromos). Sólo el texto; el
 * estilo lo pone cada plantilla con `className`.
 */
export function TemplateCartNudges({ className }: { className: string }) {
  const { nudges } = useCartPromos();
  if (nudges.length === 0) return null;
  return (
    <>
      {nudges.map((n) => (
        <p key={n.key} className={className}>
          Agregá {n.missing} más y ahorrá — {n.message}
        </p>
      ))}
    </>
  );
}
