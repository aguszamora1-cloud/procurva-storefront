import type { RawCatalogSettings, ResolvedStorefront, StoreConfig } from './types';

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
  const isPro = plan.toUpperCase() === 'PROFESIONAL';

  // Instagram puede venir como handle o URL en social_instagram, o como
  // instagram_url completo en las claves nuevas.
  const instagram = firstStr(s.instagram_url, s.social_instagram);
  const tiktok = firstStr(s.tiktok_url, s.social_tiktok);
  const shippingTitle = firstStr(s.shipping_promise_title) || DEFAULTS.shippingPromiseTitle;

  return {
    companyId: resolved.company_id,
    name: companyName,
    plan,
    isPro,
    slug: resolved.slug ?? '',
    storeType: resolved.store_type === 'wholesale' ? 'wholesale' : 'retail',
    // El modo se deriva de QUÉ tienda se está accediendo (store_type del slug resuelto),
    // no de un campo de configuración. El antiguo settings.sale_mode (incluido 'both')
    // quedó obsoleto al separarse minorista/mayorista en tiendas independientes.
    saleMode: resolved.store_type === 'wholesale' ? 'wholesale' : 'retail',
    minOrderQuantity: typeof s.min_order_quantity === 'number' && s.min_order_quantity > 0 ? s.min_order_quantity : 0,
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

    topBarText: str(s.top_bar_text),
    topBarAnimated: bool(s.top_bar_animated, false),
    tagline: str(s.tagline),
    // Barra de anuncio: SÓLO desde storefront_announcement. Si no está, queda ''
    // y la AnnouncementBar no se renderiza (no usamos top_bar_text mayorista).
    announcement: str(s.storefront_announcement),

    cardPaymentText: str(s.card_payment_text),
    installmentsCount: typeof s.card_installments === 'number' && s.card_installments > 0 ? s.card_installments : 3,

    // Hero: la IMAGEN puede reusar banner_url (es sólo una imagen), pero el
    // TEXTO sale SÓLO de las claves del storefront (hero_title/hero_subtitle).
    // No caemos a banner_text/tagline del catálogo mayorista: traen textos
    // legacy como "COLECCIÓN 2026" que no deben aparecer en la tienda minorista.
    heroEnabled: bool(s.hero_enabled, true),
    heroImageUrl: firstStr(s.hero_image_url, s.banner_url),
    heroTitle: firstStr(s.hero_title),
    heroSubtitle: firstStr(s.hero_subtitle),
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
    sectionsOrder: Array.isArray(s.sections_order)
      ? s.sections_order.filter((k): k is string => typeof k === 'string')
      : [],

    shippingPromiseEnabled: bool(s.shipping_promise_enabled, true),
    shippingPromiseTitle: shippingTitle,
    shippingPromiseSubtitle:
      firstStr(s.shipping_promise_subtitle, shippingMsg) ||
      DEFAULTS.shippingPromiseSubtitle,
    shippingMessage: str(shippingMsg),
    // trust_badges puede venir legacy (string[]) o nuevo ([{icon, text}]).
    // Extraemos el texto de cada badge y descartamos vacíos.
    trustBadgeLabels: (() => {
      const labels = Array.isArray(s.trust_badges)
        ? s.trust_badges
            .map((t) => (typeof t === 'string' ? t : str(t?.text)))
            .filter((t) => t)
        : [];
      return labels.length > 0
        ? labels
        : [shippingTitle, 'Abonás al recibir', 'Pagás como quieras', 'Compra protegida'];
    })(),
    trustBadgesBgColor: firstStr(s.trust_badges_bg_color),
    trustBadgesTextColor: firstStr(s.trust_badges_text_color) || '#000000',

    whatsapp: str(s.whatsapp),
    instagramUrl: instagram,
    facebookUrl: str(s.facebook_url),
    tiktokUrl: tiktok,
    contactEmail: str(s.contact_email),

    footerText: str(s.footer_text),
    showPoweredBy: bool(s.show_powered_by, true),
    paymentMethods: Array.isArray(s.payment_methods_icons) ? s.payment_methods_icons : [],
    mercadopagoEnabled: bool(s.mercadopago_enabled, false),

    metaTitle: firstStr(s.meta_title, companyName),
    metaDescription: str(s.meta_description),
    ogImageUrl: firstStr(s.og_image_url, s.banner_url),

    gaId: str(s.ga_id),
    metaPixelId: str(s.meta_pixel_id),

    newsletterConfig: {
      title: firstStr(s.newsletter_config?.title) || 'Suscribite a nuestras novedades',
      subtitle: firstStr(s.newsletter_config?.subtitle) || 'Recibí ofertas exclusivas y nuevos ingresos',
      buttonText: firstStr(s.newsletter_config?.button_text) || 'Suscribirme',
      successMessage: firstStr(s.newsletter_config?.success_message) || '¡Gracias por suscribirte!',
    },

    newsletterPopup: (() => {
      const p = s.newsletter_popup ?? {};
      return {
        enabled: bool(p.enabled, false),
        title: firstStr(p.title) || '10% OFF EN TU PRIMERA COMPRA',
        subtitle: firstStr(p.subtitle) || 'Sumate a la comunidad',
        buttonText: firstStr(p.button_text) || 'QUIERO MI 10% OFF',
        successMessage: firstStr(p.success_message) || '¡Listo! Revisá tu email',
        askName: bool(p.ask_name, true),
        delaySeconds: typeof p.delay_seconds === 'number' && p.delay_seconds >= 0 ? p.delay_seconds : 5,
        once: bool(p.once, true),
        bgColor: firstStr(p.bg_color) || '#FFFFFF',
        buttonColor: firstStr(p.button_color) || '#000000',
        footerText: firstStr(p.footer_text) || 'Vas a recibir un correo para validar tu email',
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
