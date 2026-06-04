-- ============================================================================
-- Storefront white-label (procurva-storefront) — config nueva del catálogo.
--
-- En ProCurva la config del catálogo NO vive en una tabla `catalog_config`:
-- vive en `companies.catalog_settings` (JSONB), que es lo que edita el panel
-- "Catálogo Online". Por eso esta migración NO agrega columnas planas — sólo
-- amplía la forma del JSONB:
--   1. Expande el DEFAULT de companies.catalog_settings con las claves nuevas.
--   2. Backfillea las filas existentes mergeando defaults (los valores ya
--      cargados por cada tenant GANAN sobre los defaults).
--
-- Idempotente y no destructivo. NO toca RLS: las políticas de lectura pública
-- (catalog_enabled = true) sobre companies / products / product_variants /
-- catalog_banners / catalog_category_order ya existen
-- (ver procurva2/supabase/migrations/20260411_online_catalog.sql y siguientes),
-- y get_my_company_id() ya tiene GRANT EXECUTE a anon.
--
-- NO aplicar automáticamente — se aplica a mano.
-- ============================================================================

-- 1) Nuevo DEFAULT de catalog_settings (incluye claves existentes + nuevas).
ALTER TABLE public.companies
  ALTER COLUMN catalog_settings SET DEFAULT '{
    "logo_url": "",
    "logo_height": 40,
    "favicon_url": "",

    "color_primary": "#000000",
    "color_secondary": "#f5f5f5",
    "color_accent": "#16a34a",
    "color_background": "#ffffff",
    "color_text": "#111111",
    "accent_color": "#16a34a",

    "font_heading": "Urbanist",
    "font_body": "Urbanist",

    "theme": "light",
    "tagline": "",
    "whatsapp": "",
    "top_bar_text": "",
    "top_bar_animated": false,

    "hero_enabled": true,
    "hero_image_url": "",
    "hero_title": "",
    "hero_subtitle": "",
    "hero_cta_text": "Ver productos",
    "hero_cta_link": "/productos",

    "section_categories": true,
    "section_featured": true,
    "section_new_arrivals": true,
    "section_outfits": false,
    "section_upsell": false,
    "section_probador": false,
    "section_stories": false,
    "section_social_proof": false,
    "section_newsletter": false,

    "shipping_promise_enabled": true,
    "shipping_promise_title": "Envío rápido",
    "shipping_promise_subtitle": "Envíos a todo el país",

    "social_instagram": "",
    "instagram_url": "",
    "facebook_url": "",
    "social_tiktok": "",
    "tiktok_url": "",
    "contact_email": "",

    "footer_text": "",
    "show_powered_by": true,

    "meta_title": "",
    "meta_description": "",
    "og_image_url": "",

    "payment_methods_icons": [],
    "mercadopago_enabled": false
  }'::jsonb;

-- 2) Backfill: completar claves faltantes en filas existentes sin pisar lo
--    que cada tenant ya cargó. Los valores actuales (lado derecho del `||`)
--    ganan sobre los defaults (lado izquierdo).
UPDATE public.companies AS c
SET catalog_settings = defaults.val || COALESCE(c.catalog_settings, '{}'::jsonb)
FROM (
  SELECT '{
    "logo_url": "",
    "logo_height": 40,
    "favicon_url": "",
    "color_primary": "#000000",
    "color_secondary": "#f5f5f5",
    "color_accent": "#16a34a",
    "color_background": "#ffffff",
    "color_text": "#111111",
    "accent_color": "#16a34a",
    "font_heading": "Urbanist",
    "font_body": "Urbanist",
    "theme": "light",
    "tagline": "",
    "whatsapp": "",
    "top_bar_text": "",
    "top_bar_animated": false,
    "hero_enabled": true,
    "hero_image_url": "",
    "hero_title": "",
    "hero_subtitle": "",
    "hero_cta_text": "Ver productos",
    "hero_cta_link": "/productos",
    "section_categories": true,
    "section_featured": true,
    "section_new_arrivals": true,
    "section_outfits": false,
    "section_upsell": false,
    "section_probador": false,
    "section_stories": false,
    "section_social_proof": false,
    "section_newsletter": false,
    "shipping_promise_enabled": true,
    "shipping_promise_title": "Envío rápido",
    "shipping_promise_subtitle": "Envíos a todo el país",
    "social_instagram": "",
    "instagram_url": "",
    "facebook_url": "",
    "social_tiktok": "",
    "tiktok_url": "",
    "contact_email": "",
    "footer_text": "",
    "show_powered_by": true,
    "meta_title": "",
    "meta_description": "",
    "og_image_url": "",
    "payment_methods_icons": [],
    "mercadopago_enabled": false
  }'::jsonb AS val
) AS defaults
WHERE c.catalog_settings IS NULL
   OR NOT (c.catalog_settings ? 'color_primary');  -- sólo filas aún sin las claves nuevas

-- ============================================================================
-- Diccionario de claves nuevas de catalog_settings (todas opcionales):
--   Diseño:   logo_url, favicon_url, logo_height,
--             color_primary, color_secondary, color_accent,
--             color_background, color_text, font_heading, font_body
--   Hero:     hero_enabled, hero_image_url, hero_title, hero_subtitle,
--             hero_cta_text, hero_cta_link
--   Secciones: section_categories, section_featured, section_new_arrivals,
--             section_outfits, section_upsell, section_probador,
--             section_stories, section_social_proof, section_newsletter
--   Envío:    shipping_promise_enabled, shipping_promise_title,
--             shipping_promise_subtitle
--   Social:   instagram_url, facebook_url, tiktok_url, contact_email
--   Footer:   footer_text, show_powered_by
--   SEO:      meta_title, meta_description, og_image_url
--   Pagos:    payment_methods_icons (text[]), mercadopago_enabled
--
-- Claves reusadas que ya existían (el storefront las mapea):
--   logo_url, logo_height, accent_color (→ color_accent), banner_url
--   (→ hero_image_url), banner_text (→ hero_title), tagline (→ hero_subtitle),
--   whatsapp, social_instagram (→ instagram_url), social_tiktok (→ tiktok_url),
--   top_bar_text, theme.
-- ============================================================================
