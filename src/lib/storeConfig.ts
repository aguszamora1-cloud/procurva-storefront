import type { HeroCtaStyle, PurchaseFlowStep, RawCatalogSettings, ResolvedStorefront, StoreConfig } from './types';
import { resolveProductLayoutOrNull } from './productLayout';
import { resolveQuantityTiersSettings } from '../components/QuantityTierSelector';

/** Pasos por defecto del flujo de compra (si el comercio no configuró los suyos). */
export const DEFAULT_PURCHASE_FLOW: PurchaseFlowStep[] = [
  { name: 'Comprás online', detail: 'Pagás con tarjeta, transferencia o efectivo', state: 'done' },
  { name: 'Preparamos tu pedido', detail: 'En 24hs hábiles', state: 'done' },
  { name: 'Te lo enviamos', detail: 'Envío gratis · 2-5 días al interior', state: 'current' },
  { name: 'Recibís en tu casa', detail: 'Con seguimiento en tiempo real', state: 'pending' },
];

const VALID_STATES = new Set(['done', 'current', 'pending']);

/** Saneamos los pasos crudos del JSONB: descarta los sin nombre y normaliza el estado. */
function parsePurchaseFlowSteps(raw: unknown): PurchaseFlowStep[] {
  if (!Array.isArray(raw)) return DEFAULT_PURCHASE_FLOW;
  const steps = raw
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      const name = str(o.name);
      if (!name) return null;
      const state = typeof o.state === 'string' && VALID_STATES.has(o.state) ? o.state : 'pending';
      return { name, detail: str(o.detail), state: state as PurchaseFlowStep['state'] };
    })
    .filter((s): s is PurchaseFlowStep => s !== null);
  return steps.length > 0 ? steps : DEFAULT_PURCHASE_FLOW;
}

// Defaults de la config del storefront. Coinciden con los defaults de la
// migración 20260604_storefront_config.sql.
const DEFAULTS = {
  colorPrimary: '#000000',
  colorSecondary: '#f5f5f5',
  colorAccent: '#16a34a',
  colorBackground: '#ffffff',
  colorText: '#111111',
  // RSW usa Urbanist como fuente única; la dejamos de default (editable por tenant).
  fontHeading: 'Urbanist',
  fontBody: 'Urbanist',
  heroCtaLink: '/productos',
  shippingPromiseTitle: 'Envío rápido',
  shippingPromiseSubtitle: 'Envíos a todo el país',
  shippingPromiseColor: '#00a650',
};

const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' && v.trim() ? v.trim() : fallback;

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback;

/** Toma la primera clave no vacía (para mapear claves nuevas ↔ existentes). */
const firstStr = (...vals: unknown[]): string => {
  for (const v of vals) {
    const s = str(v);
    if (s) return s;
  }
  return '';
};

/**
 * Texto de PANTALLA con tres estados, no dos (el mismo criterio que
 * resolveSectionHeadings, generalizado):
 *   - clave ausente → el comercio nunca tocó el campo → default histórico;
 *   - string vacío  → lo borró a propósito → '' y no se pinta NADA;
 *   - con texto     → ese texto.
 *
 * Con `str(v) || default` los dos primeros casos colapsaban en uno: borrar el
 * campo en el editor devolvía el default y no había forma de dejar la sección
 * sin ese texto.
 *
 * OJO: es sólo para texto decorativo (títulos, bajadas, epígrafes). Los textos
 * FUNCIONALES —labels de botones, de badges, mensajes de resultado— se siguen
 * resolviendo con `firstStr(...) || default`: un botón sin texto no es un botón
 * más limpio, es un botón roto.
 */
const optionalText = (raw: unknown, fallback: string): string =>
  typeof raw === 'string' ? raw.trim() : fallback;

/**
 * Aspecto del botón del hero. Los valores desconocidos (o la clave ausente en
 * las tiendas anteriores al selector) caen al look histórico: esquinas apenas
 * redondeadas, tamaño mediano y color de marca — exactamente lo que el hero
 * pintaba hardcodeado, así que nadie ve cambiar su tienda por este deploy.
 */
function resolveHeroCta(raw: { shape?: string; size?: string; variant?: string } | undefined): HeroCtaStyle {
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  return {
    shape: pick(raw?.shape, ['rounded', 'square', 'pill'] as const, 'rounded'),
    size: pick(raw?.size, ['sm', 'md', 'lg'] as const, 'md'),
    variant: pick(raw?.variant, ['accent', 'light', 'dark', 'outline'] as const, 'accent'),
  };
}

/**
 * Modo del hero. El selector del editor existe desde hace rato pero la tienda
 * nunca leyó el valor, así que hay tiendas con 'image_only' guardado por defecto
 * Y textos cargados que hoy se muestran. Respetar el modo a ciegas les apagaría
 * el título de un día para el otro: sólo se respeta si está explícito, y la
 * clave ausente queda en 'auto' (se muestra lo que haya).
 */
function resolveHeroMode(raw: unknown): 'image_only' | 'image_with_text' | 'auto' {
  return raw === 'image_only' || raw === 'image_with_text' ? raw : 'auto';
}

/**
 * Encabezados por defecto de las secciones del home: `label` es el volanta chico
 * de arriba y `title` el titular grande (SectionHeader los pinta en ese orden).
 *
 * Son los textos que la tienda venía mostrando hardcodeados. El comercio los
 * pisa desde el editor (Catálogo Online → sección → Título / Subtítulo), que
 * guarda en `catalog_settings.section_titles`. OJO con el cruce de nombres: el
 * campo "Subtítulo" del panel es el volanta de arriba (`label` acá), no el
 * párrafo de abajo.
 */
const SECTION_HEADING_DEFAULTS: Record<string, { label: string; title: string }> = {
  categories: { label: 'Explorá', title: 'Categorías' },
  featured: { label: 'Lo más buscado', title: 'Destacados' },
  new_arrivals: { label: 'Recién llegados', title: 'Nuevos ingresos' },
  offers: { label: 'Aprovechá', title: 'Ofertas' },
  outfits: { label: 'Combiná tu look', title: 'Outfits' },
  social_proof: { label: 'Lo que dicen', title: 'Reseñas de clientes' },
};

/**
 * Encabezados resueltos por sección: lo que cargó el comercio, y si no cargó
 * nada, el default histórico. Se resuelve acá (y no en cada componente) por la
 * misma razón que el resto de la config: la StoreConfig se cachea ya normalizada.
 *
 * Los DOS campos distinguen tres estados, no dos:
 *  - la clave no existe  → el comercio nunca tocó esta sección → default;
 *  - la clave está vacía → la borró a propósito → NO se muestra ese texto;
 *  - con texto           → ese texto.
 * Sin esa distinción, borrar el campo devolvía el default y no había forma de
 * dejar la sección sin encabezado.
 *
 * Si el TITULAR queda vacío, la volanta tampoco se muestra (lo resuelve
 * SectionHeader): una línea chica suelta arriba de la grilla, sin titular que la
 * sostenga, se lee como un texto perdido.
 */
function resolveSectionHeadings(
  raw: Record<string, { title?: string; subtitle?: string }> | undefined,
): Record<string, { label: string; title: string }> {
  const out: Record<string, { label: string; title: string }> = {};
  for (const [key, def] of Object.entries(SECTION_HEADING_DEFAULTS)) {
    const cfg = raw?.[key];
    const cleared = (v: unknown): boolean => typeof v === 'string' && !v.trim();
    out[key] = {
      label: cleared(cfg?.subtitle) ? '' : str(cfg?.subtitle) || def.label,
      title: cleared(cfg?.title) ? '' : str(cfg?.title) || def.title,
    };
  }
  return out;
}

/**
 * Normaliza el payload saneado de la RPC `get_storefront_by_slug` /
 * `verify_storefront_password` (con su `settings` JSONB por tienda) a la
 * StoreConfig que consume la UI. Reusa las claves que el panel "Catálogo
 * Online" de ProCurva ya escribe (logo_url, accent_color, banner_*, socials,
 * whatsapp, tagline) y completa con defaults las claves nuevas del storefront.
 */
export function normalizeStoreConfig(resolved: ResolvedStorefront): StoreConfig {
  const s: RawCatalogSettings = resolved.settings ?? {};
  const shippingMsg = resolved.shipping_message ?? '';
  const companyName = resolved.name ?? 'Tienda';
  // Normalizamos el plan: trim + uppercase. El valor en la DB puede venir como
  // 'PROFESIONAL', 'profesional' o con espacios/saltos ocultos; cualquiera de esos
  // debe contar como PRO.
  const plan = (resolved.plan ?? 'starter').toString().trim();
  const planUpper = plan.toUpperCase();
  const isPro = planUpper === 'PROFESIONAL';
  // Plan pago: TIENDA o PROFESIONAL (habilita features de plan TIENDA en adelante,
  // como el recomendador de talle).
  const isPaid = planUpper === 'TIENDA' || planUpper === 'PROFESIONAL';

  // Instagram puede venir como handle o URL en social_instagram, o como
  // instagram_url completo en las claves nuevas.
  const instagram = firstStr(s.instagram_url, s.social_instagram);
  const tiktok = firstStr(s.tiktok_url, s.social_tiktok);
  const shippingTitle = optionalText(s.shipping_promise_title, DEFAULTS.shippingPromiseTitle);

  return {
    companyId: resolved.company_id,
    name: companyName,
    plan,
    isPro,
    isPaid,
    slug: resolved.slug ?? '',
    storeType: resolved.store_type === 'wholesale' ? 'wholesale' : 'retail',
    saleMode:
      s.sale_mode === 'wholesale' || s.sale_mode === 'both'
        ? s.sale_mode
        : resolved.store_type === 'wholesale'
          ? 'wholesale'
          : 'retail',
    minOrderQuantity: typeof s.min_order_quantity === 'number' && s.min_order_quantity > 0 ? s.min_order_quantity : 0,
    minOrderAmount: typeof s.min_order_amount === 'number' && s.min_order_amount > 0 ? s.min_order_amount : 0,
    minOrderMode:
      s.min_order_mode === 'amount' || s.min_order_mode === 'both' ? s.min_order_mode : 'units',
    // Horario de entrega: default obligatorio (comportamiento histórico). El
    // comercio puede volverlo opcional desde Catálogo Online → Checkout.
    requireDeliveryTime: bool(s.require_delivery_time, true),
    policyShipping: str(s.envio_politica),
    policyReturns: str(s.cambios_politica),
    policyPayments: str(s.pagos_politica),

    logoUrl: str(s.logo_url) || str(resolved.logo_url),
    logoHeight: typeof s.logo_height === 'number' ? s.logo_height : 40,
    faviconUrl: str(s.favicon_url),

    colorPrimary: firstStr(s.color_primary) || DEFAULTS.colorPrimary,
    colorSecondary: firstStr(s.color_secondary) || DEFAULTS.colorSecondary,
    // accent: clave nueva color_accent, si no la vieja accent_color.
    colorAccent: firstStr(s.color_accent, s.accent_color) || DEFAULTS.colorAccent,
    colorBackground: firstStr(s.color_background) || DEFAULTS.colorBackground,
    colorText: firstStr(s.color_text) || DEFAULTS.colorText,

    fontHeading: firstStr(s.font_heading) || DEFAULTS.fontHeading,
    fontBody: firstStr(s.font_body) || DEFAULTS.fontBody,

    // Alineación de títulos de secciones: key nueva (section_title_align) con
    // fallback a la vieja (category_title_align) para no romper configs viejas.
    sectionTitleAlign: ((): 'left' | 'center' | 'right' => {
      const v = s.section_title_align ?? s.category_title_align;
      return v === 'center' || v === 'right' ? v : 'left';
    })(),

    // Modo de visualización de la sección de categorías. Default 'grid'.
    categoriesDisplayMode: s.categories_display_mode === 'carousel' ? 'carousel' : 'grid',

    // Círculos de color en las cards. Default true: es lo que venían mostrando
    // todas las tiendas, y la clave no existe en ninguna todavía.
    showVariantColors: bool(s.show_variant_colors, true),

    // Diseño de la sección de categorías. Columns default 3; cardStyle default 'overlay'.
    categoriesSection: {
      columns: ((): 2 | 3 | 4 => {
        const c = s.categories_section?.columns;
        return c === 2 || c === 3 || c === 4 ? c : 3;
      })(),
      cardStyle: ((): 'overlay' | 'below' | 'full' => {
        const v = s.categories_section?.card_style;
        return v === 'below' || v === 'full' ? v : 'overlay';
      })(),
    },

    topBarAnimated: bool(s.top_bar_animated, false),
    tagline: str(s.tagline),
    // Barra de anuncio, con PRECEDENCIA: manda storefront_announcement; si está
    // vacío cae a top_bar_text. Nunca al revés — quien ya escribió su anuncio no
    // puede verlo pisado por un texto viejo.
    //
    // Antes esto era `str(s.storefront_announcement)` a secas y top_bar_text no
    // se leía en ningún lado, así que el campo "Texto superior (promo)" del
    // editor guardaba y no mostraba nada. La exclusión venía de que las claves
    // legacy traían texto rancio de la época del catálogo mayorista (el caso
    // testigo fue "COLECCIÓN 2026" en el hero). Verificado contra producción:
    // ese texto vive en `catalog_settings`, que la RPC sirve como fallback del
    // canal RETAIL — el blob de mayorista (storefront_config->wholesale->settings)
    // nació vacío en el backfill de 20260607 y no tiene ninguna clave legacy. De
    // los 65 storefronts publicados, sólo 2 estrenan barra con esto, y ninguna
    // de las que ya tenían anuncio cambia.
    announcement: firstStr(s.storefront_announcement, s.top_bar_text),

    cardPaymentText: str(s.card_payment_text),
    installmentsCount: typeof s.card_installments === 'number' && s.card_installments > 0 ? s.card_installments : 3,

    // Hero: la IMAGEN puede reusar banner_url (es sólo una imagen), pero el
    // TEXTO sale SÓLO de las claves del storefront (hero_title/hero_subtitle).
    // No caemos a banner_text/tagline del catálogo mayorista: traen textos
    // legacy como "COLECCIÓN 2026" que no deben aparecer en la tienda minorista.
    heroEnabled: bool(s.hero_enabled, true),
    heroImageUrl: firstStr(s.hero_image_url, s.banner_url),
    heroImageMobileUrl: firstStr(s.hero_image_url_mobile, s.banner_url_mobile),
    heroTitle: firstStr(s.hero_title),
    heroSubtitle: firstStr(s.hero_subtitle),
    // Sin default: el botón del hero sólo aparece si el comercio cargó el texto.
    heroCtaText: firstStr(s.hero_cta_text),
    heroCtaLink: firstStr(s.hero_cta_link) || DEFAULTS.heroCtaLink,
    heroCta: resolveHeroCta(s.hero_cta_style),
    heroMode: resolveHeroMode(s.hero_mode),

    sections: {
      categories: bool(s.section_categories, true),
      featured: bool(s.section_featured, true),
      newArrivals: bool(s.section_new_arrivals, true),
      // Ofertas existía sin flag (se autoocultaba con la lista vacía). El default
      // true es obligatorio, no cosmético: reproduce lo que ven las tiendas que
      // nunca van a tener `section_offers` guardado.
      offers: bool(s.section_offers, true),
      outfits: bool(s.section_outfits, false),
      upsell: bool(s.section_upsell, false),
      probador: bool(s.section_probador, false),
      virtualTryon: bool(s.section_virtual_tryon, false),
      stories: bool(s.section_stories, false),
      reels: bool(s.section_reels, false),
      socialProof: bool(s.section_social_proof, false),
      productReviews: bool(s.section_product_reviews, false),
      newsletter: bool(s.section_newsletter, false),
      trustBadges: bool(s.section_trust_badges, true),
    },
    sectionsOrder: Array.isArray(s.sections_order)
      ? s.sections_order.filter((k): k is string => typeof k === 'string')
      : [],
    // Máximo de CARDS por sección de productos del home. El corte se hace sobre
    // las cards ya expandidas por color (ver limitSectionCards), no sobre
    // productos: antes se cortaba en 12 PRODUCTOS y una sección con productos
    // multicolor terminaba pintando 30+ cards.
    //
    // Default 12 = el SECTION_LIMIT histórico, a propósito: así el deploy cambia
    // SÓLO el significado del límite y no el número que ve cada tienda.
    //
    // Se resuelve ACÁ y no en el punto de lectura porque el sessionStorage
    // cachea esta StoreConfig ya normalizada: un default resuelto al leer nunca
    // llegaría a la entrada cacheada. El clamp también va acá — el JSONB puede
    // traer 0, negativos o basura y la tienda no puede quedar en cero cards.
    sectionMaxItems: (() => {
      const v = s.section_max_items;
      if (typeof v !== 'number' || !Number.isFinite(v)) return 12;
      return Math.min(24, Math.max(4, Math.round(v)));
    })(),
    // Título de la sección de videos del home (section_titles.reels.title del
    // admin). Del lado del comprador nunca se llama "Reels": ese es el nombre
    // interno del panel. Vaciarlo desde el editor deja el carrusel sin titular.
    reelsTitle: optionalText(s.section_titles?.reels?.title, 'Videos'),
    // Encabezados (volanta + titular) de las secciones del home, con el default
    // histórico de cada una si el comercio no cargó el suyo.
    sectionHeadings: resolveSectionHeadings(s.section_titles),
    // Layout de la ficha resuelto (null = el tenant no lo configuró → render legacy).
    productLayout: resolveProductLayoutOrNull(s.product_layout),

    // Bloque "Complementarios": defaults del spec. titulo se deja como quedó
    // (vacío → la UI cae a 'Combinalo con'); el resto resuelve a un valor concreto.
    complementaryBlock: (() => {
      const c = s.complementary_block ?? {};
      const max = c.maximo_visible;
      return {
        titulo: optionalText(c.titulo, 'Combinalo con'),
        maximoVisible: (max === 2 || max === 3 || max === 4 ? max : 3) as 2 | 3 | 4,
        ocultarSinStock: bool(c.ocultar_sin_stock, true),
        mostrarOtrosColores: bool(c.mostrar_otros_colores, true),
        mostrarOutfit: bool(c.mostrar_outfit, true),
        outfitPresentacion: c.outfit_presentacion === 'en_lista' ? 'en_lista' : 'card_destacada',
        outfitDesempate: c.outfit_desempate === 'mas_vendido' ? 'mas_vendido' : 'orden_manual',
      };
    })(),

    // Escalones por cantidad ("Lleva N"): sólo la PRESENTACIÓN. Los escalones y
    // sus % salen de category_volume_tiers. Ausencia de clave = default, resuelto
    // por resolveQuantityTiersSettings (misma fuente que usa el admin).
    ...(() => {
      const q = resolveQuantityTiersSettings(s);
      return {
        quantityTiersLayout: q.quantityTiersLayout,
        quantityTiersShowSavings: q.quantityTiersShowSavings,
        quantityTiersShowCardPrice: q.quantityTiersShowCardPrice,
      };
    })(),

    shippingPromiseEnabled: bool(s.shipping_promise_enabled, true),
    shippingPromiseTitle: shippingTitle,
    // Subtítulo: SOLO lo que el comercio cargó. Sin fallback a shipping_message
    // (duplicaba el título cuando coincidían) ni al default: vacío → no se
    // renderiza el "· subtítulo", solo el título.
    shippingPromiseSubtitle: firstStr(s.shipping_promise_subtitle),
    shippingPromiseColor: firstStr(s.shipping_promise_color) || DEFAULTS.shippingPromiseColor,
    shippingMessage: str(shippingMsg),
    // trust_badges puede venir legacy (string[]) o nuevo ([{icon, text}]).
    // Extraemos el texto de cada badge y descartamos vacíos.
    trustBadgeLabels: (() => {
      const labels = Array.isArray(s.trust_badges)
        ? s.trust_badges
            .map((t) => (typeof t === 'string' ? t : str(t?.text)))
            .filter((t) => t)
        : [];
      // El primer badge por defecto es el título de la promesa de envío, que
      // ahora puede estar vaciado a propósito: lo filtramos para no pintar un
      // badge en blanco.
      return labels.length > 0
        ? labels
        : [shippingTitle, 'Abonás al recibir', 'Pagás como quieras', 'Compra protegida'].filter(Boolean);
    })(),
    trustBadgesBgColor: firstStr(s.trust_badges_bg_color),
    trustBadgesTextColor: firstStr(s.trust_badges_text_color) || '#000000',

    // Badges de las product cards. Defaults pensados para no cambiar el aspecto
    // de tiendas existentes: lowStock/discount/freeShipping activos (freeShipping
    // no aparece hasta marcar un producto), "Nuevo" apagado por defecto.
    badges: (() => {
      const b = s.badges ?? {};
      const num = (v: unknown, d: number) => (typeof v === 'number' && v > 0 ? v : d);
      const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
      return {
        // Globales. Defaults conservadores para no alterar tiendas existentes.
        style: b.style === 'glass' || b.style === 'outline' ? b.style : 'solid',
        position: (POSITIONS as readonly string[]).includes(b.position as string)
          ? (b.position as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right')
          : 'top-left',
        showIcons: bool(b.show_icons, true),
        lowStock: {
          enabled: bool(b.low_stock?.enabled, true),
          color: firstStr(b.low_stock?.color) || '#EF4444',
          label: firstStr(b.low_stock?.label) || 'Últimas unidades',
          threshold: num(b.low_stock?.threshold, 5),
        },
        new: {
          enabled: bool(b.new?.enabled, false),
          color: firstStr(b.new?.color) || '#2563EB',
          label: firstStr(b.new?.label) || 'Nuevo',
          windowDays: num(b.new?.window_days, 14),
        },
        freeShipping: {
          enabled: bool(b.free_shipping?.enabled, true),
          color: firstStr(b.free_shipping?.color) || '#16A34A',
          label: firstStr(b.free_shipping?.label) || 'Envío gratis',
        },
        discount: {
          enabled: bool(b.discount?.enabled, true),
          // Vacío → la card cae al color de acento (comportamiento histórico).
          color: firstStr(b.discount?.color),
          label: firstStr(b.discount?.label) || '% OFF',
        },
        // Color global de la etiqueta del catálogo. Default rojo (era el default
        // de products.catalog_badge_color) para no cambiar tiendas existentes.
        custom: {
          color: firstStr(b.custom?.color) || '#EF4444',
        },
      };
    })(),

    purchaseFlowEnabled: bool(s.purchase_flow_enabled, true),
    purchaseFlowSteps: parsePurchaseFlowSteps(s.purchase_flow_steps),

    whatsapp: str(s.whatsapp),
    instagramUrl: instagram,
    facebookUrl: str(s.facebook_url),
    tiktokUrl: tiktok,
    contactEmail: str(s.contact_email),

    footerText: str(s.footer_text),
    showPoweredBy: bool(s.show_powered_by, true),
    paymentMethods: Array.isArray(s.payment_methods_icons) ? s.payment_methods_icons : [],
    mercadopagoEnabled: bool(s.mercadopago_enabled, false),
    gocuotasEnabled: bool(s.gocuotas_enabled, false),
    // Transferencia bancaria directa. Cae a null si no está habilitada o si no hay
    // NINGÚN dato (ni estructurado ni texto libre): el checkout mantiene su flujo
    // anterior y no muestra un bloque vacío.
    transferAccount: (() => {
      const t = s.transfer_account;
      if (!s.transfer_enabled || !t) return null;
      const acc = {
        name: str(t.name),
        alias: str(t.alias),
        cbu: str(t.cbu),
        holder: str(t.holder),
        cuit: str(t.cuit),
        details: str(t.details),
      };
      return (acc.alias || acc.cbu || acc.holder || acc.cuit || acc.details) ? acc : null;
    })(),

    metaTitle: firstStr(s.meta_title, companyName),
    metaDescription: str(s.meta_description),
    ogImageUrl: firstStr(s.og_image_url, s.banner_url),

    gaId: str(s.ga_id),
    metaPixelId: str(s.meta_pixel_id),

    // title/subtitle son decorativos: vaciarlos los saca de la sección.
    // buttonText y successMessage NO: son funcionales (un botón sin texto y una
    // confirmación muda se leen como un formulario roto).
    newsletterConfig: {
      title: optionalText(s.newsletter_config?.title, 'Suscribite a nuestras novedades'),
      subtitle: optionalText(s.newsletter_config?.subtitle, 'Recibí ofertas exclusivas y nuevos ingresos'),
      buttonText: firstStr(s.newsletter_config?.button_text) || 'Suscribirme',
      successMessage: firstStr(s.newsletter_config?.success_message) || '¡Gracias por suscribirte!',
    },

    newsletterPopup: (() => {
      const p = s.newsletter_popup ?? {};
      return {
        enabled: bool(p.enabled, false),
        // Igual que la sección: título/bajada/pie son decorativos y se pueden
        // vaciar; el botón y el mensaje de éxito no.
        title: optionalText(p.title, '10% OFF EN TU PRIMERA COMPRA'),
        subtitle: optionalText(p.subtitle, 'Sumate a la comunidad'),
        buttonText: firstStr(p.button_text) || 'QUIERO MI 10% OFF',
        successMessage: firstStr(p.success_message) || '¡Listo! Revisá tu email',
        askName: bool(p.ask_name, true),
        delaySeconds: typeof p.delay_seconds === 'number' && p.delay_seconds >= 0 ? p.delay_seconds : 5,
        once: bool(p.once, true),
        bgColor: firstStr(p.bg_color) || '#FFFFFF',
        buttonColor: firstStr(p.button_color) || '#000000',
        footerText: optionalText(p.footer_text, 'Vas a recibir un correo para validar tu email'),
        couponCode: (firstStr(p.coupon_code) || '').toUpperCase(),
      };
    })(),

    promoBanner: {
      enabled: bool(s.promo_banner?.enabled, false),
      text: str(s.promo_banner?.text),
      bgColor: firstStr(s.promo_banner?.bg_color) || '#E53E3E',
      textColor: firstStr(s.promo_banner?.text_color) || '#FFFFFF',
      countdownEnabled: bool(s.promo_banner?.countdown_enabled, false),
      countdownEnd: str(s.promo_banner?.countdown_end),
      endedText: str(s.promo_banner?.ended_text),
      position: s.promo_banner?.position === 'below_navbar' ? 'below_navbar' : 'top',
      textSize:
        s.promo_banner?.text_size === 'sm' || s.promo_banner?.text_size === 'lg'
          ? s.promo_banner.text_size
          : 'md',
    },
  };
}

/** Normaliza un handle/URL de Instagram a URL completa. */
export function instagramHref(value: string): string {
  if (!value) return '';
  if (value.startsWith('http')) return value;
  const handle = value.replace(/^@/, '').trim();
  return `https://instagram.com/${handle}`;
}
