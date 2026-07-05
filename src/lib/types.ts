// Tipos del dominio leídos del Supabase de ProCurva. Sólo lectura.

import type { ProductLayout } from './productLayout';

/** Imagen de producto: en `products.images` puede venir string o {url}. */
export type ProductImage = string | { url?: string };

/** Fila cruda de product_variants. */
export interface Variant {
  id: string;
  product_id: string;
  company_id: string;
  size: string | null;
  color: string | null;
  stock: number | null;
  price: number | null;
  sku: string | null;
  image_url: string | null;
}

/** Secciones personalizadas (catalog_custom_sections). Sólo lectura. */
export type CustomSectionType = 'banner' | 'text';
export type CustomSectionPageContext = 'home' | 'product_detail';
export type ProductDetailSlot = 'above_description' | 'below_description' | 'below_gallery' | 'below_product';

export interface CustomSectionBannerSlide {
  image_url?: string;
  mobile_image_url?: string;
  link_url?: string;
  alt_text?: string;
}

export type BannerDisplayMode = 'carousel' | 'scroll' | 'phone_mockup';

export interface CustomSectionBannerContent {
  images?: CustomSectionBannerSlide[];
  autoplay?: boolean;
  interval_seconds?: number;
  display_mode?: BannerDisplayMode;
  title?: string;
  slot?: ProductDetailSlot;
  // Legacy (banners de 1 imagen previos al carrusel).
  image_url?: string;
  mobile_image_url?: string;
  link_url?: string;
  alt_text?: string;
}

export interface CustomSectionTextContent {
  heading?: string;
  body?: string;
  text_align?: 'left' | 'center' | 'right';
  background_color?: string;
  slot?: ProductDetailSlot;
}

export interface CustomSection {
  id: string;
  company_id: string;
  catalog_type: 'retail' | 'wholesale';
  section_type: CustomSectionType;
  label: string;
  content: CustomSectionBannerContent | CustomSectionTextContent;
  is_visible: boolean;
  page_context: CustomSectionPageContext;
  position: number;
}

/** Fila cruda de products (+ variants anidadas). */
export interface Product {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  retail_price: number | null;
  retail_price_transfer: number | null;
  retail_price_card: number | null;
  compare_at_price: number | null;
  // Precio mayorista base ("por talle" / suelto). Solo se usa cuando storeType==='wholesale'.
  wholesale_price: number | null;
  image_url: string | null;
  images: ProductImage[] | null;
  categories: string[] | null;
  catalog_visible: boolean | null;
  catalog_badge_text: string | null;
  catalog_badge_color: string | null;
  catalog_badge_visible: boolean | null;
  pack_only_sale: boolean | null;
  // Habilita la "curva surtida" (color por talle según stock) en el detalle
  // mayorista. Default false; si no viene en el SELECT se trata como apagada.
  curva_surtida_enabled?: boolean | null;
  // Marca de producto destacado (sección "Destacados" del home).
  is_featured: boolean | null;
  // Marca de "Nuevo Ingreso" (sección "Nuevos Ingresos" del home).
  is_new_arrival?: boolean | null;
  // Si true, el storefront muestra cada color como una card separada en el catálogo.
  display_variants_separately?: boolean | null;
  // Envío gratis manual por producto (lo marca el comercio en la ficha). Si el
  // badge global "Envío gratis" está activo y esto es true, la card lo muestra.
  free_shipping?: boolean | null;
  created_at: string | null;
  product_variants: Variant[];
  // ── Campos sintéticos de una "virtual card" por color (los agrega
  // toCatalogCards cuando display_variants_separately está activo). En un
  // producto normal vienen undefined. El `id` sigue siendo el real (para el
  // link y los lookups por id); estos campos sólo afectan el render de la card. ──
  /** Color de esta virtual card. */
  variant_color?: string | null;
  /** Otros colores del mismo producto, para los swatches de la card. */
  sibling_colors?: string[] | null;
  /** key estable para el grid (id real + color), evita colisión de keys. */
  card_key?: string;
}

/** Precio por cantidad de curvas (mayorista). product_curve_price_tiers. */
export interface CurvePriceTier {
  product_id: string;
  curve_quantity: number;
  price_per_unit: number;
}

/** Composición de una curva: cuántas unidades de cada talle. product_curves. */
export interface CurveDist {
  product_id: string;
  size: string;
  quantity: number;
}

/**
 * Modo de armado del pack (product_packs.pack_type):
 *  - single_color: todos los items comparten color.
 *  - assorted: colores surtidos.
 *  - free_color: color a definir por el comprador (items con color vacío).
 *  - no_distribution: sin distribución de talles (solo total_units).
 */
export type PackType = 'single_color' | 'assorted' | 'free_color' | 'no_distribution';

/** Item de distribución de un pack (color + talle). product_pack_items. */
export interface PackItem {
  color: string;
  size: string;
  quantity: number;
}

/** Escalón de precio por cantidad de packs. product_pack_price_tiers. */
export interface PackPriceTier {
  min_packs: number;
  max_packs: number | null;
  price_per_unit: number;
}

/**
 * Pack de venta (media docena / docena / bulto) con su distribución de talles y
 * sus escalones de precio por volumen. La categoría (media docena / docena /
 * bulto) se infiere de total_units. product_packs + items + price_tiers.
 */
export interface ProductPack {
  id: string;
  product_id: string;
  pack_type: PackType;
  name: string;
  total_units: number;
  is_active: boolean;
  items: PackItem[];
  price_tiers: PackPriceTier[];
}

/** Banner del catálogo. */
export interface Banner {
  id: string;
  company_id: string;
  image_url: string;
  image_url_mobile: string | null;
  link_url: string | null;
  sort_order: number | null;
  active: boolean | null;
}

/** Story destacada del home (Extra PRO). */
export interface Story {
  id: string;
  company_id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  order: number | null;
  active: boolean | null;
}

/** Testimonio de cliente (Social Proof, Extra PRO). */
export interface Testimonial {
  id: string;
  company_id: string;
  catalog_type: 'retail' | 'wholesale';
  customer_name: string;
  customer_photo_url: string | null;
  text: string;
  rating: number | null;
  order: number | null;
  active: boolean | null;
}

/** Reseña asociada a un producto puntual (Extra PRO), mostrada en su detalle. */
export interface ProductReview {
  id: string;
  product_id: string;
  customer_name: string;
  customer_photo_url: string | null;
  text: string;
  rating: number | null;
  order: number | null;
  active: boolean | null;
}

/** Item de un outfit (referencia a un producto). */
export interface OutfitItem {
  product_id: string;
  order: number | null;
}

/** Outfit / look (Extra PRO): combinación de productos. */
export interface Outfit {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  order: number | null;
  active: boolean | null;
  items: OutfitItem[];
}

/** Un paso del flujo de compra ("Así funciona tu compra"). */
export interface PurchaseFlowStep {
  name: string;
  detail: string;
  /** Estado visual: completado (check verde), actual (oscuro) o pendiente (gris). */
  state: 'done' | 'current' | 'pending';
}

/** catalog_settings crudo (JSONB). Todas las claves son opcionales. */
export interface RawCatalogSettings {
  logo_url?: string;
  logo_height?: number;
  favicon_url?: string;
  accent_color?: string;
  color_primary?: string;
  color_secondary?: string;
  color_accent?: string;
  color_background?: string;
  color_text?: string;
  font_heading?: string;
  font_body?: string;
  theme?: 'dark' | 'light';
  // Alineación de los títulos de todas las secciones del home.
  section_title_align?: 'left' | 'center' | 'right';
  // Legacy: nombre viejo de la misma config. Se usa como fallback.
  category_title_align?: 'left' | 'center' | 'right';
  // Modo de visualización de la sección de categorías en el home.
  categories_display_mode?: 'grid' | 'carousel';
  // Diseño de la sección de categorías: columnas (en desktop) y estilo de card.
  // Las imágenes por categoría NO viven acá: se guardan en
  // catalog_category_order.image_url (las lee useCategories como cat.imageUrl).
  categories_section?: {
    columns?: 2 | 3 | 4;
    card_style?: 'overlay' | 'below' | 'full';
  };
  tagline?: string;
  whatsapp?: string;
  // Modo de venta de la tienda (seam para la fase de render mayorista).
  sale_mode?: 'retail' | 'wholesale' | 'both';
  // Mínimo de compra para la tienda mayorista. Tres criterios posibles:
  //  - 'units'  → mínimo por cantidad de unidades (min_order_quantity)
  //  - 'amount' → mínimo por monto del carrito (min_order_amount)
  //  - 'both'   → deben cumplirse ambos a la vez
  // min_order_quantity se conserva con su semántica histórica (default 'units').
  min_order_quantity?: number;
  min_order_amount?: number;
  min_order_mode?: 'units' | 'amount' | 'both';
  // Políticas de la tienda (acordeones en el detalle).
  envio_politica?: string;
  cambios_politica?: string;
  pagos_politica?: string;
  top_bar_text?: string;
  top_bar_animated?: boolean;
  // Pagos / cuotas
  card_payment_text?: string;
  card_installments?: number;
  banner_url?: string;
  banner_url_mobile?: string;
  banner_text?: string;
  // Texto de la barra superior EXCLUSIVO del storefront minorista. Si no está,
  // no se muestra la barra (no usamos top_bar_text, que es del catálogo mayorista).
  storefront_announcement?: string;
  // Hero (nuevas claves del storefront)
  hero_enabled?: boolean;
  hero_image_url?: string;
  hero_image_url_mobile?: string;
  hero_title?: string;
  hero_subtitle?: string;
  hero_cta_text?: string;
  hero_cta_link?: string;
  // Secciones
  section_categories?: boolean;
  section_featured?: boolean;
  section_new_arrivals?: boolean;
  section_outfits?: boolean;
  section_upsell?: boolean;
  section_probador?: boolean;
  section_virtual_tryon?: boolean;
  section_stories?: boolean;
  section_social_proof?: boolean;
  section_product_reviews?: boolean;
  section_newsletter?: boolean;
  section_trust_badges?: boolean;
  // Orden de las secciones del home (keys), configurado en el admin (drag & drop).
  sections_order?: string[];
  // Layout personalizable de la ficha de producto (drag & drop del admin). Cada
  // token es un id de bloque predefinido o una referencia `custom:<uuid>` a una
  // sección custom del detalle. Ausente/null = layout por defecto (render legacy).
  // Ver src/lib/productLayout.ts.
  product_layout?: { right_column?: string[]; below_product?: string[] } | null;
  // Shipping promise
  shipping_promise_enabled?: boolean;
  shipping_promise_title?: string;
  shipping_promise_subtitle?: string;
  shipping_promise_color?: string;
  // Trust badges (etiquetas configurables; 4 textos).
  // Legacy: string[]. Nuevo (panel ProCurva): [{icon, text}].
  trust_badges?: Array<string | { icon?: string; text?: string }>;
  // Color de fondo de la barra de trust badges. Vacío = transparente.
  trust_badges_bg_color?: string;
  // Color del texto e íconos de la barra de trust badges. Default #000000.
  trust_badges_text_color?: string;
  // Badges de las product cards (Últimas unidades / Nuevo / Envío gratis /
  // Descuento). Cada uno: on/off, color de fondo (texto por contraste) y label;
  // low_stock/new con su parámetro propio. Lo escribe el panel Diseño → Badges.
  badges?: {
    // Globales (aplican a todos los badges por igual).
    style?: 'solid' | 'glass' | 'outline';
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    show_icons?: boolean;
    // Por badge.
    low_stock?: { enabled?: boolean; color?: string; label?: string; threshold?: number };
    new?: { enabled?: boolean; color?: string; label?: string; window_days?: number };
    free_shipping?: { enabled?: boolean; color?: string; label?: string };
    discount?: { enabled?: boolean; color?: string; label?: string };
  };
  // Flujo de compra ("Así funciona tu compra") en el detalle de producto.
  purchase_flow_enabled?: boolean;
  purchase_flow_steps?: PurchaseFlowStep[];
  // Social
  social_instagram?: string;
  instagram_url?: string;
  facebook_url?: string;
  social_tiktok?: string;
  tiktok_url?: string;
  contact_email?: string;
  // Footer
  footer_text?: string;
  show_powered_by?: boolean;
  // SEO
  meta_title?: string;
  meta_description?: string;
  og_image_url?: string;
  // Analytics (slots: si están, se inyectan los scripts)
  ga_id?: string;
  meta_pixel_id?: string;
  // Pagos
  payment_methods_icons?: string[];
  mercadopago_enabled?: boolean;
  // Habilita GoCuotas (cuotas sin interés con débito) en el checkout del storefront.
  gocuotas_enabled?: boolean;
  // Transferencia bancaria directa: snapshot de la cuenta destino del ecommerce
  // (lo escribe el admin de ProCurva). Si transfer_enabled y hay datos, el
  // checkout muestra alias/CBU/titular + CUIT con botones de copiar/comprobante.
  transfer_enabled?: boolean;
  transfer_account?: {
    name?: string;
    alias?: string;
    cbu?: string;
    holder?: string;
    cuit?: string;
    details?: string;
  } | null;
  // Newsletter (Extra PRO): textos del formulario.
  newsletter_config?: {
    title?: string;
    subtitle?: string;
    button_text?: string;
    success_message?: string;
  };
  // Newsletter — popup de captura (Extra PRO).
  newsletter_popup?: {
    enabled?: boolean;
    title?: string;
    subtitle?: string;
    button_text?: string;
    success_message?: string;
    ask_name?: boolean;
    delay_seconds?: number;
    once?: boolean;
    bg_color?: string;
    button_color?: string;
    footer_text?: string;
    coupon_code?: string;
  };
  // Franja promocional (PRO) con countdown.
  promo_banner?: {
    enabled?: boolean;
    text?: string;
    bg_color?: string;
    text_color?: string;
    countdown_enabled?: boolean;
    countdown_end?: string;
    ended_text?: string;
    position?: 'top' | 'below_navbar';
    text_size?: 'sm' | 'md' | 'lg';
  };
}

/** Fila cruda de companies (campos que leemos). */
export interface CompanyRow {
  id: string;
  name: string;
  plan: string | null;
  catalog_enabled: boolean | null;
  catalog_slug: string | null;
  catalog_settings: RawCatalogSettings | null;
  catalog_shipping_message: string | null;
}

/** Tipo de tienda resuelta por slug. */
export type StoreType = 'retail' | 'wholesale';

/**
 * Payload saneado que devuelve la RPC `get_storefront_by_slug` (o
 * `verify_storefront_password`). NUNCA incluye el password de la tienda.
 * Para una tienda mayorista protegida sin desbloquear, `settings` viene null
 * y sólo trae branding mínimo (`name`, `logo_url`) para pintar el gate.
 */
export interface ResolvedStorefront {
  company_id: string;
  name: string | null;
  plan: string | null;
  store_type: StoreType;
  slug: string;
  requires_password: boolean;
  /**
   * Disponibilidad de la tienda (toggle "página en construcción" del admin).
   * `false` ⇒ la tienda está publicada pero el comercio la desactivó
   * temporalmente: el storefront muestra la página de aviso en vez del catálogo.
   * Optativo / default true: payloads viejos o `verify_storefront_password` no lo traen.
   */
  active?: boolean;
  /**
   * Mensaje personalizado para la página "en construcción" (cuando active=false).
   * Si es null/vacío, el storefront usa el texto genérico.
   */
  message?: string | null;
  shipping_message: string | null;
  logo_url?: string | null;
  settings: RawCatalogSettings | null;
}

/** Config normalizada que consume toda la UI. */
export interface StoreConfig {
  companyId: string;
  name: string;
  plan: string;
  isPro: boolean;
  /** Plan pago (TIENDA o PROFESIONAL) — habilita features de plan TIENDA en adelante. */
  isPaid: boolean;
  slug: string;
  // Tipo de tienda resuelta + modo de venta (seam para la fase de render mayorista).
  storeType: StoreType;
  saleMode: 'retail' | 'wholesale' | 'both';
  // Mínimo de compra en mayorista. 0 = sin mínimo. El modo define qué criterio
  // se exige (unidades, monto, o ambos). Retail ignora estos valores.
  minOrderQuantity: number;
  minOrderAmount: number;
  minOrderMode: 'units' | 'amount' | 'both';
  // Políticas de la tienda (acordeones del detalle). '' = no mostrar.
  policyShipping: string;
  policyReturns: string;
  policyPayments: string;
  // Branding
  logoUrl: string;
  logoHeight: number;
  faviconUrl: string;
  // Colores
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  colorBackground: string;
  colorText: string;
  // Tipografía
  fontHeading: string;
  fontBody: string;
  // Alineación de los títulos de todas las secciones del home.
  sectionTitleAlign: 'left' | 'center' | 'right';
  // Modo de visualización de la sección de categorías del home.
  categoriesDisplayMode: 'grid' | 'carousel';
  // Diseño de la sección de categorías: columnas (desktop, 2 fijas en mobile) y
  // estilo de card. Las imágenes por categoría viven en catalog_category_order.
  categoriesSection: {
    columns: 2 | 3 | 4;
    cardStyle: 'overlay' | 'below' | 'full';
  };
  // Top bar
  topBarText: string;
  topBarAnimated: boolean;
  tagline: string;
  // Barra de anuncio del storefront (storefront_announcement). '' = no mostrar.
  announcement: string;
  // Pagos / cuotas
  cardPaymentText: string;
  installmentsCount: number;
  // Hero
  heroEnabled: boolean;
  heroImageUrl: string;
  /** Versión mobile opcional del hero. Si está vacía, mobile usa heroImageUrl. */
  heroImageMobileUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroCtaLink: string;
  // Secciones
  sections: {
    categories: boolean;
    featured: boolean;
    newArrivals: boolean;
    outfits: boolean;
    upsell: boolean;
    probador: boolean;
    virtualTryon: boolean;
    stories: boolean;
    socialProof: boolean;
    productReviews: boolean;
    newsletter: boolean;
    trustBadges: boolean;
  };
  // Orden de las secciones del home (keys del admin). Vacío = orden por defecto.
  sectionsOrder: string[];
  // Layout de la ficha de producto resuelto (o null si el tenant no configuró
  // uno). null = render legacy fijo (idéntico a antes). Ver productLayout.ts.
  productLayout: ProductLayout | null;
  // Shipping
  shippingPromiseEnabled: boolean;
  shippingPromiseTitle: string;
  shippingPromiseSubtitle: string;
  shippingPromiseColor: string;
  shippingMessage: string;
  // Trust badges (4 etiquetas)
  trustBadgeLabels: string[];
  // Color de fondo de la barra de trust badges ('' = transparente).
  trustBadgesBgColor: string;
  // Color del texto e íconos de la barra de trust badges (independiente de --color-text).
  trustBadgesTextColor: string;
  // Badges de las product cards, normalizados con defaults. El texto se resuelve
  // por contraste sobre `color`. `discount.color` vacío = usa el color de acento.
  badges: {
    // Globales (estilo, esquina de anclaje y si se muestran los íconos).
    style: 'solid' | 'glass' | 'outline';
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    showIcons: boolean;
    // Por badge.
    lowStock: { enabled: boolean; color: string; label: string; threshold: number };
    new: { enabled: boolean; color: string; label: string; windowDays: number };
    freeShipping: { enabled: boolean; color: string; label: string };
    discount: { enabled: boolean; color: string; label: string };
  };
  // Flujo de compra ("Así funciona tu compra") en el detalle de producto.
  purchaseFlowEnabled: boolean;
  purchaseFlowSteps: PurchaseFlowStep[];
  // Social / contacto
  whatsapp: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  contactEmail: string;
  // Footer
  footerText: string;
  showPoweredBy: boolean;
  paymentMethods: string[];
  // Pagos online (MercadoPago Checkout Pro). true si el comercio conectó su MP.
  mercadopagoEnabled: boolean;
  // Pagos en cuotas con GoCuotas. true si el comercio lo habilitó en el editor.
  gocuotasEnabled: boolean;
  // Cuenta para transferencia bancaria directa (snapshot del admin). null si el
  // comercio no asignó cuenta destino o no cargó ningún dato (alias/CBU/details):
  // en ese caso el checkout cae al flujo de Transferencia anterior (MP/WhatsApp).
  transferAccount: {
    name: string;
    alias: string;
    cbu: string;
    holder: string;
    cuit: string;
    details: string;
  } | null;
  // SEO
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  // Analytics (vacío = no inyectar nada)
  gaId: string;
  metaPixelId: string;
  // Newsletter (Extra PRO): textos del formulario, con defaults aplicados.
  newsletterConfig: {
    title: string;
    subtitle: string;
    buttonText: string;
    successMessage: string;
  };
  // Newsletter — popup de captura (Extra PRO), con defaults aplicados.
  newsletterPopup: {
    enabled: boolean;
    title: string;
    subtitle: string;
    buttonText: string;
    successMessage: string;
    askName: boolean;
    delaySeconds: number;
    once: boolean;
    bgColor: string;
    buttonColor: string;
    footerText: string;
    couponCode: string;
  };
  // Franja promocional (PRO) con countdown.
  promoBanner: {
    enabled: boolean;
    text: string;
    bgColor: string;
    textColor: string;
    countdownEnabled: boolean;
    countdownEnd: string;
    endedText: string;
    position: 'top' | 'below_navbar';
    textSize: 'sm' | 'md' | 'lg';
  };
}

/** Item del carrito (persistido en localStorage). */
export interface CartItem {
  product_id: string;
  variant_id: string;
  name: string;
  // Categorías del producto (para promos por cantidad con scope categoría).
  // Opcional: carritos viejos no la tienen -> no cuentan para promos por categoría.
  categories?: string[] | null;
  size: string | null;
  color: string | null;
  unit_price: number;
  // Precio unitario de contado (efectivo/transferencia) cuando es más barato que
  // `unit_price` (que en retail es el de tarjeta). Solo lo setea retail suelto si
  // hay descuento por contado. Si falta (carritos viejos, mayorista) se usa
  // `unit_price` para todos los métodos.
  unit_price_cash?: number;
  qty: number;
  image_url: string | null;
  // Modo de compra mayorista. 'suelto' (default), 'curva', 'curva_surtida' o 'pack'.
  // Retail no lo setea. 'curva_surtida' = curva con color por talle asignado
  // server-side al confirmar (NO trae variant_id; el cliente solo elige cantidad).
  source?: 'suelto' | 'curva' | 'curva_surtida' | 'pack';
  // Cantidad de curvas elegida (source==='curva' o 'curva_surtida'), para agrupar/mostrar.
  curves?: number;
  // Precio por unidad del tier (solo source==='curva_surtida'). Viaja al staging
  // para que el server lo use al explotar las variantes surtidas.
  curve_price_per_unit?: number;
  // Id único de línea (solo source==='curva_surtida'): cada curva surtida es una
  // línea propia que NO se fusiona con otras (no tiene variant_id para distinguirlas).
  lineId?: string;
  // Datos del pack (solo source==='pack'), para agrupar/mostrar y recalcular precio.
  packId?: string;
  packLabel?: string;
  // Cantidad de packs elegida (solo source==='pack').
  packs?: number;
  // ── Promoción automática aplicada a este item (si la hubo). El `unit_price`
  // (y `unit_price_cash`) YA vienen con el descuento de la promo restado; estos
  // campos son para mostrar el ahorro en el carrito y trackear la venta por
  // promo (se serializan dentro de catalog_orders.items, sin migración). ──
  promo_id?: string;
  promo_name?: string;
  // Precio unitario ORIGINAL (antes de la promo), para mostrar el tachado/ahorro.
  unit_price_original?: number;
  // Si la promo NO es acumulable con cupones (gatea el cupón en el checkout).
  promo_stackable?: boolean;
}
