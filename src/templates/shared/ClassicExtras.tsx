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
 *
 * FIN0 (correcciones visuales, 25/11): dos piezas NO se montan tal cual porque
 * mostraban información que la tienda no respalda:
 *  - «Así funciona tu compra»: Classic, si el comercio nunca guardó sus pasos,
 *    pinta unos por defecto con promesas fijas («Envío gratis · 2-5 días al
 *    interior», «Con seguimiento en tiempo real») y, en todos los casos, marca
 *    etapas como cumplidas antes de comprar. Acá sólo van los pasos que el
 *    comercio escribió, numerados y sin estado (TemplatePurchaseSteps).
 *  - Reseñas de la ficha: Classic, sin reseñas verificadas del producto, muestra
 *    los testimonios del home como «Opiniones de clientes» de ESE producto, con
 *    promedio. Acá sólo se muestran si hay reseñas verificadas del producto (los
 *    testimonios siguen en el home, donde el comercio los publicó).
 * Classic no cambia.
 */
import { useLocation } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { useCartPromos } from '@/hooks/useCartPromos';
import { useProductReviews } from '@/hooks/useProductReviews';
import { FloatingWhatsApp } from '@/components/FloatingWhatsApp';
import { ShippingCalculator } from '@/components/ShippingCalculator';
import { ProductReviews } from '@/components/ProductReviews';
import { resolveProductLayoutOrNull } from '@/lib/productLayout';
import type { Product, StoreConfig } from '@/lib/types';
import { merchantPurchaseSteps } from './storeFacts';
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
 * «Así funciona tu compra» de las plantillas: los pasos del comercio como una
 * secuencia numerada, sin tildes de «hecho» ni «en curso» (quien mira la ficha
 * todavía no compró nada). El texto es el del comercio, sin agregados.
 */
function TemplatePurchaseSteps({ steps }: { steps: StoreConfig['purchaseFlowSteps'] }) {
  return (
    <section className="tpl-steps" aria-labelledby="tpl-steps-title">
      <p id="tpl-steps-title" className="tpl-steps__title">
        Así funciona tu compra
      </p>
      <ol className="tpl-steps__list">
        {steps.map((s, i) => (
          <li key={i} className="tpl-steps__item">
            <span className="tpl-steps__num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="tpl-steps__text">
              <span className="tpl-steps__name">{s.name}</span>
              {s.detail && <span className="tpl-steps__detail">{s.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Columna de compra: calculadora de envío y «Así funciona tu compra», en el mismo
 * orden que Classic. La calculadora con la misma condición que allá; los pasos,
 * sólo los que escribió el comercio (ver merchantPurchaseSteps).
 */
export function TemplatePdpExtras({ ink, product }: { ink: TemplateInk; product: Product }) {
  const config = useStore();
  const shipping = config.showShippingCalculator !== false;
  const steps = layoutShows(product, config, 'purchase_flow') ? merchantPurchaseSteps(config) : [];
  const flow = steps.length > 0;
  if (!shipping && !flow) return null;
  return (
    <StoreSurface ink={ink}>
      <div className="tpl-pdp-extras" data-cols={shipping && flow ? 2 : 1}>
        {shipping && <ShippingCalculator productId={product.id} />}
        {flow && <TemplatePurchaseSteps steps={steps} />}
      </div>
    </StoreSurface>
  );
}

/**
 * Reseñas de la ficha (Extra PRO), con la misma condición que Classic, pero SÓLO
 * con reseñas verificadas de este producto: sin ellas Classic caería a los
 * testimonios del home presentados como opiniones del producto.
 */
export function TemplatePdpReviews({ ink, product }: { ink: TemplateInk; product: Product }) {
  const config = useStore();
  const allowed = config.isPro && config.sections.productReviews && layoutShows(product, config, 'reviews');
  const { reviews } = useProductReviews(allowed ? product.id : undefined);
  if (!allowed || reviews.length === 0) return null;
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
