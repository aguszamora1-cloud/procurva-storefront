# ProCurva Storefront

Frontend público **white-label y multi-tenant** para las tiendas de los usuarios de
[ProCurva](https://procurva.app). Cada cliente tiene su tienda minorista en
`{slug}.procurva.app`, renderizada con un template profesional parametrizado por la
config de cada tenant.

Es **de sólo lectura**: lee la config y los datos que se gestionan desde el panel
"Catálogo Online" del ERP (repo `procurva2`). No tiene panel admin ni crea tablas
nuevas — usa el mismo Supabase de ProCurva (`kmafsugiixkpmqxgetug`).

## Stack

React 19 · Vite · TypeScript · Tailwind CSS · React Router · @supabase/supabase-js · Lucide.

## Arquitectura

- **Resolución de tenant** (`src/lib/tenant.ts`): extrae el slug del subdominio
  (`{slug}.procurva.app`). En `localhost` usa `VITE_DEV_SLUG`. Host genérico → 404 branded.
- **StoreProvider** (`src/context/StoreProvider.tsx`): busca el `companies` por
  `catalog_slug` (con `catalog_enabled = true`) y normaliza `catalog_settings` (JSONB)
  a una `StoreConfig`.
- **Theming dinámico** (`src/lib/theme.ts`): inyecta CSS variables (`--color-*`) y
  Google Fonts según la config. Todos los componentes leen de esas variables.
- **Datos** (`src/hooks/`): `products` + `product_variants`, `catalog_banners`,
  `catalog_category_order` — siempre filtrados por `company_id`.
- **Checkout**: MercadoPago Checkout Pro (Edge `create-preference` + `catalog_orders`)
  y/o WhatsApp con mensaje prellenado, según lo que tenga configurado el tenant.

## Producción (Fase 4)

- **Code-splitting**: cada página se carga lazy (`React.lazy` + `Suspense`); los
  vendors (`react`, `supabase`, `lucide`) van en chunks aparte (`vite.config.ts`).
- **Imágenes** (`src/components/StoreImage.tsx` + `src/lib/images.ts`): thumbnails
  servidos por la transformación de Supabase Storage (`render/image`), con
  `loading`/`decoding`/dimensiones intrínsecas y fallback automático a la URL
  original si el proyecto no tiene Image Transformations.
- **Config cacheada** (stale-while-revalidate, TTL 5 min) en `sessionStorage`
  (`StoreProvider`): primer paint instantáneo + revalidación en segundo plano.
- **SEO dinámico** (`src/components/Seo.tsx`, `src/lib/seo.ts`): title, description,
  Open Graph, Twitter Card, canonical (`{slug}.procurva.app`) y robots por página.
- **robots.txt / sitemap.xml**: serverless por tenant (`api/robots.ts`,
  `api/sitemap.ts`), ruteados en `vercel.json` antes del catch-all del SPA. Leen
  Supabase con la anon key (reusan `VITE_SUPABASE_*`, disponibles en runtime en Vercel).
- **Analytics-ready** (`src/components/Analytics.tsx`): si el tenant cargó
  `catalog_settings.ga_id` (GA4) y/o `meta_pixel_id` (Meta Pixel), se inyectan los
  scripts; si no, no hace nada.
- **Resiliencia**: `ErrorBoundary` + pantallas de error amigables, estados de error
  con reintento en las grillas, 404 branded (tienda inexistente y ruta interna).

## Desarrollo

```sh
cp .env.example .env.local   # completar VITE_SUPABASE_ANON_KEY y VITE_DEV_SLUG
npm install
npm run dev                  # http://localhost:3000
npm run build
```

`VITE_DEV_SLUG` debe ser el `catalog_slug` de un tenant real con `catalog_enabled = true`.

## Migración

`supabase/migrations/20260604_storefront_config.sql` amplía la forma del JSONB
`companies.catalog_settings` con las claves nuevas del storefront. **No se aplica
automáticamente** — aplicar a mano. No toca RLS (las políticas de lectura pública ya
existen en `procurva2`).

## Deploy

Vercel. Requiere DNS wildcard `*.procurva.app` apuntando al proyecto (infra).
Env vars `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` ya configuradas en Vercel.
