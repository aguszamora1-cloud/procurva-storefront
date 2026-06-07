// Tipos del dominio leídos del Supabase de ProCurva. Sólo lectura.

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
  // Marca de producto destacado (sección "Destacados" del home).
  is_featured: boolean | null;
  created_at: string | null;
  product_variants: Variant[];
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
  tagline?: string;
  whatsapp?: string;
  // Modo de venta de la tienda (seam para la fase de render mayorista).
  sale_mode?: 'retail' | 'wholesale' | 'both';
  // Mínimo de compra (unidades totales) para la tienda mayorista.
  min_order_quantity?: number;
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
  banner_text?: string;
  // Texto de la barra superior EXCLUSIVO del storefront minorista. Si no está,
  // no se muestra la barra (no usamos top_bar_text, que es del catálogo mayorista).
  storefront_announcement?: string;
  // Hero (nuevas claves del storefront)
  hero_enabled?: boolean;
  hero_image_url?: string;
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
  section_stories?: boolean;
  section_social_proof?: boolean;
  section_newsletter?: boolean;
  section_trust_badges?: boolean;
  // Orden de las secciones del home (keys), configurado en el admin (drag & drop).
  sections_order?: string[];
  // Shipping promise
  shipping_promise_enabled?: boolean;
  shipping_promise_title?: string;
  shipping_promise_subtitle?: string;
  // Trust badges (etiquetas configurables; 4 textos).
  // Legacy: string[]. Nuevo (panel ProCurva): [{icon, text}].
  trust_badges?: Array<string | { icon?: string; text?: string }>;
  // Color de fondo de la barra de trust badges. Vacío = transparente.
  trust_badges_bg_color?: string;
  // Color del texto e íconos de la barra de trust badges. Default #000000.
  trust_badges_text_color?: string;
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
  slug: string;
  // Tipo de tienda resuelta + modo de venta (seam para la fase de render mayorista).
  storeType: StoreType;
  saleMode: 'retail' | 'wholesale' | 'both';
  // Mínimo de compra (unidades) en mayorista. 0 = sin mínimo.
  minOrderQuantity: number;
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
    stories: boolean;
    socialProof: boolean;
    newsletter: boolean;
    trustBadges: boolean;
  };
  // Orden de las secciones del home (keys del admin). Vacío = orden por defecto.
  sectionsOrder: string[];
  // Shipping
  shippingPromiseEnabled: boolean;
  shippingPromiseTitle: string;
  shippingPromiseSubtitle: string;
  shippingMessage: string;
  // Trust badges (4 etiquetas)
  trustBadgeLabels: string[];
  // Color de fondo de la barra de trust badges ('' = transparente).
  trustBadgesBgColor: string;
  // Color del texto e íconos de la barra de trust badges (independiente de --color-text).
  trustBadgesTextColor: string;
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
  size: string | null;
  color: string | null;
  unit_price: number;
  qty: number;
  image_url: string | null;
  // Modo de compra mayorista. 'suelto' (default) o 'curva'. Retail no lo setea.
  source?: 'suelto' | 'curva';
  // Cantidad de curvas elegida (solo source==='curva'), para agrupar/mostrar en el carrito.
  curves?: number;
}
