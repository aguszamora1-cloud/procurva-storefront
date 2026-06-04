import type { CompanyRow, RawCatalogSettings, StoreConfig } from './types';

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
 * Normaliza una fila de `companies` (con su `catalog_settings` JSONB) a la
 * StoreConfig que consume la UI. Reusa las claves que el panel "Catálogo
 * Online" de ProCurva ya escribe (logo_url, accent_color, banner_*, socials,
 * whatsapp, tagline) y completa con defaults las claves nuevas del storefront.
 */
export function normalizeStoreConfig(company: CompanyRow): StoreConfig {
  const s: RawCatalogSettings = company.catalog_settings ?? {};
  const plan = (company.plan ?? 'starter').toString();
  const isPro = plan.toUpperCase() === 'PROFESIONAL';

  // Instagram puede venir como handle o URL en social_instagram, o como
  // instagram_url completo en las claves nuevas.
  const instagram = firstStr(s.instagram_url, s.social_instagram);
  const tiktok = firstStr(s.tiktok_url, s.social_tiktok);
  const shippingTitle = firstStr(s.shipping_promise_title) || DEFAULTS.shippingPromiseTitle;

  return {
    companyId: company.id,
    name: company.name ?? 'Tienda',
    plan,
    isPro,
    slug: company.catalog_slug ?? '',

    logoUrl: str(s.logo_url),
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

    topBarText: str(s.top_bar_text),
    topBarAnimated: bool(s.top_bar_animated, false),
    tagline: str(s.tagline),

    cardPaymentText: str(s.card_payment_text),
    installmentsCount: typeof s.card_installments === 'number' && s.card_installments > 0 ? s.card_installments : 3,

    // Hero: claves nuevas hero_* con fallback a banner_* (lo que ya existe).
    heroEnabled: bool(s.hero_enabled, true),
    heroImageUrl: firstStr(s.hero_image_url, s.banner_url),
    heroTitle: firstStr(s.hero_title, s.banner_text),
    heroSubtitle: firstStr(s.hero_subtitle, s.tagline),
    // Sin default: el botón del hero sólo aparece si el comercio cargó el texto.
    heroCtaText: firstStr(s.hero_cta_text),
    heroCtaLink: firstStr(s.hero_cta_link) || DEFAULTS.heroCtaLink,

    sections: {
      categories: bool(s.section_categories, true),
      featured: bool(s.section_featured, true),
      newArrivals: bool(s.section_new_arrivals, true),
      outfits: bool(s.section_outfits, false),
      upsell: bool(s.section_upsell, false),
      probador: bool(s.section_probador, false),
      stories: bool(s.section_stories, false),
      socialProof: bool(s.section_social_proof, false),
      newsletter: bool(s.section_newsletter, false),
      trustBadges: bool(s.section_trust_badges, true),
    },

    shippingPromiseEnabled: bool(s.shipping_promise_enabled, true),
    shippingPromiseTitle: shippingTitle,
    shippingPromiseSubtitle:
      firstStr(s.shipping_promise_subtitle, company.catalog_shipping_message) ||
      DEFAULTS.shippingPromiseSubtitle,
    shippingMessage: str(company.catalog_shipping_message),
    trustBadgeLabels:
      Array.isArray(s.trust_badges) && s.trust_badges.length > 0
        ? s.trust_badges.map((t) => String(t))
        : [shippingTitle, 'Abonás al recibir', 'Pagás como quieras', 'Compra protegida'],

    whatsapp: str(s.whatsapp),
    instagramUrl: instagram,
    facebookUrl: str(s.facebook_url),
    tiktokUrl: tiktok,
    contactEmail: str(s.contact_email),

    footerText: str(s.footer_text),
    showPoweredBy: bool(s.show_powered_by, true),
    paymentMethods: Array.isArray(s.payment_methods_icons) ? s.payment_methods_icons : [],
    mercadopagoEnabled: bool(s.mercadopago_enabled, false),

    metaTitle: firstStr(s.meta_title, company.name),
    metaDescription: str(s.meta_description),
    ogImageUrl: firstStr(s.og_image_url, s.banner_url),
  };
}

/** Normaliza un handle/URL de Instagram a URL completa. */
export function instagramHref(value: string): string {
  if (!value) return '';
  if (value.startsWith('http')) return value;
  const handle = value.replace(/^@/, '').trim();
  return `https://instagram.com/${handle}`;
}
