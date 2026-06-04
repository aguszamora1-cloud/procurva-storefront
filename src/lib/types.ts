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
  image_url: string | null;
  images: ProductImage[] | null;
  categories: string[] | null;
  catalog_visible: boolean | null;
  catalog_badge_text: string | null;
  catalog_badge_color: string | null;
  catalog_badge_visible: boolean | null;
  pack_only_sale: boolean | null;
  created_at: string | null;
  product_variants: Variant[];
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
  tagline?: string;
  whatsapp?: string;
  top_bar_text?: string;
  top_bar_animated?: boolean;
  // Pagos / cuotas
  card_payment_text?: string;
  card_installments?: number;
  banner_url?: string;
  banner_text?: string;
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
  // Shipping promise
  shipping_promise_enabled?: boolean;
  shipping_promise_title?: string;
  shipping_promise_subtitle?: string;
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
  // Pagos
  payment_methods_icons?: string[];
  mercadopago_enabled?: boolean;
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
  catalog_template_id: string | null;
  settings: Record<string, unknown> | null;
}

/** Config normalizada que consume toda la UI. */
export interface StoreConfig {
  companyId: string;
  name: string;
  plan: string;
  isPro: boolean;
  slug: string;
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
  // Top bar
  topBarText: string;
  topBarAnimated: boolean;
  tagline: string;
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
  };
  // Shipping
  shippingPromiseEnabled: boolean;
  shippingPromiseTitle: string;
  shippingPromiseSubtitle: string;
  shippingMessage: string;
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
  // SEO
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
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
}
