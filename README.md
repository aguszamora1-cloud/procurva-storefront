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
- **Checkout (Fase 1)**: por WhatsApp con mensaje prellenado. MercadoPago queda para Fase 2.

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
