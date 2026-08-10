# AUDIT_LOCAL — infraestructura existente para la sección "Dónde encontrarnos"

Auditoría **read-only** del 2026-08-09. No se modificó código ni se creó ninguna migración.

Dos repos involucrados:

- **`procurva-storefront`** — la tienda pública (rutas relativas de este archivo).
- **`ProCurva/procurva2`** — el ERP/admin, donde vive el editor visual. Se cita con prefijo `procurva2/`.

Todo lo de acá abajo está verificado leyendo el código. Donde no encontré algo, dice **no encontrado**.

---

## 1. Registro de secciones del HOME — caso testigo: "Videos" (`catalog_reels`)

Una sección del home **no existe en un solo lugar**: hay que tocar siete archivos repartidos en los dos repos. Esto es lo que atravesó `reels`, de punta a punta.

### 1.1 La definición canónica (admin)

`procurva2/components/catalog/catalogShared.tsx:169`

```ts
{ key: 'reels', settingKey: 'section_reels', label: 'Videos', defaultOn: false, pro: true, editableTitle: true, home: true }
```

El shape está en `SectionDef` (`catalogShared.tsx:117-139`):

| campo | qué hace |
|---|---|
| `key` | id estable; se usa en `sections_order` y en `section_titles` |
| `settingKey` | nombre del flag booleano on/off dentro de `catalog_settings` |
| `label` | nombre en el editor (**interno**: al comprador nunca le decimos "Reels") |
| `defaultOn` | valor cuando el flag no está guardado |
| `pro` / `tier` | plan mínimo |
| `editableTitle` | si tiene Título/Subtítulo editables |
| `home: true` | **es lo que la hace aparecer en la lista arrastrable del editor** |

Los defaults de texto van aparte, en `SECTION_DEFAULT_TITLES` (`catalogShared.tsx:350-361`; `reels: { title: 'Videos', subtitle: '' }`).

### 1.2 Cómo entra en la lista arrastrable

`procurva2/components/catalog/editor/homeSections.ts:25`

```ts
export const HOME_KEYS: string[] = SECTIONS.filter((s) => s.home).map((s) => s.key);
```

**Se deriva de `SECTIONS`, no se escribe a mano.** El comentario de `homeSections.ts:14-24` documenta por qué: antes eran dos listas paralelas y se desincronizaron — `stories` y después `reels` estaban en `SECTIONS` pero faltaban en la lista literal, así que **el editor las filtraba y no aparecían nunca**. Hoy alcanza con `home: true`.

El orden se manipula con tres helpers del mismo archivo: `moveHomeSection` (`:57`), `reorderHomeSections` (`:88`, la que consume el drag) y `toggleHomeSection` (`:103`). Los tres preservan las secciones custom (`custom:<uuid>`) derivando sus ids del propio orden guardado.

### 1.3 Metadata del editor visual + panel de edición

- `procurva2/components/catalog/editor/sections.ts:43` → `reels: { label: 'Videos', view: 'home', pro: true }`. El shape es `EditorSectionMeta` (`sections.ts:8-14`). Este registro es **paralelo** al de `catalogShared` y también hay que tocarlo.
- `procurva2/components/catalog/editor/StoreEditorPanel.tsx:245-252` → el `switch` que decide qué controles se abren. `reels` usa el patrón `ManagedSection` (modal ancho) porque el panel lateral angosto no alcanza para una lista de medios:

```tsx
case 'reels':
  return (
    <ManagedSection title="Videos" description="…">
      {ctx.companyId ? <ReelsManager companyId={ctx.companyId} placement="home" /> : <p>Guardá la tienda antes…</p>}
    </ManagedSection>
  );
```

`ReelsManager` (`procurva2/components/catalog/ReelsManager.tsx`) escribe **directo a la tabla**, no espera al botón Guardar general.

### 1.4 El lado tienda

- Flag: `src/lib/storeConfig.ts:280` (`reels: bool(s.section_reels, false)`), tipado en `src/lib/types.ts:846`.
- Título: `src/lib/storeConfig.ts:309` — `reelsTitle` sale de `section_titles.reels.title` con fallback `'Videos'`.
- Nodo: `src/pages/Home.tsx:141` → `reels: config.isPro && config.sections.reels ? <ReelsSection /> : null`.
- Componente: `src/components/home/ReelsSection.tsx:11-16`. **Si no hay datos devuelve `null`**, sin estado vacío ni placeholder — es el patrón del repo para secciones alimentadas por tabla.
- Orden por defecto: `src/pages/Home.tsx:43-55` (`DEFAULT_SECTION_ORDER`), con `reels` entre `outfits` y `stories`.

### 1.5 Cómo se persiste el orden — leelo antes de diseñar

El orden vive en **`catalog_settings.sections_order`** (array de strings), normalizado en `src/lib/storeConfig.ts:286`. La pieza importante es `withMissingSections` (`src/pages/Home.tsx:74-88`), y el comentario de `:57-73` explica el incidente:

> Antes se appendeaban al final, y eso hacía que cada sección nueva aterrizara abajo de todo sin que nadie se enterara: a un tenant le dejó Ofertas y Videos debajo del Newsletter, al fondo de la home.

Hoy una sección que falta en el orden guardado se inserta **anclando por predecesores** de `DEFAULT_SECTION_ORDER`, respetando lo que el comercio movió a mano.

> **Implicancia para "Dónde encontrarnos":** si la agregás como sección fija, tenés que ponerla en `DEFAULT_SECTION_ORDER` **en la posición donde querés que caiga** para los ~66 tenants que ya tienen su `sections_order` guardado. Si te la olvidás, no se rompe nada: `withMissingSections` sólo recorre `DEFAULT_SECTION_ORDER`, así que la sección **no se renderiza nunca** en un tenant con orden guardado (ver la nota de `Home.tsx:38-42`: "si no está en `nodes`, no se renderiza" — y el espejo, si no está en `DEFAULT_SECTION_ORDER`, no entra al orden).

**Checklist de archivos para una sección fija nueva (7 puntos):**

1. `procurva2/components/catalog/catalogShared.tsx` → entrada en `SECTIONS` con `home: true` + `SECTION_DEFAULT_TITLES`
2. `procurva2/components/catalog/editor/sections.ts` → `SECTION_META`
3. `procurva2/components/catalog/editor/StoreEditorPanel.tsx` → `case` con el panel
4. `procurva2/types.ts` → el flag `section_*` en `CatalogSettings`
5. `src/lib/types.ts` → el flag crudo + el resuelto en `StoreConfig.sections`
6. `src/lib/storeConfig.ts` → normalización del flag
7. `src/pages/Home.tsx` → nodo en `nodes` **y** key en `DEFAULT_SECTION_ORDER`

---

## 2. Registro de secciones de la FICHA DE PRODUCTO — ¿mismo sistema?

**Son dos sistemas separados, con un tercero cruzándolos.** Detalle:

### 2.1 Sistema A — bloques predefinidos del layout de ficha

- Admin: `procurva2/components/catalog/editor/productLayout.ts:25-42` (`PRODUCT_ELEMENTS`). Shape `LayoutElement` (`:9-22`): `{ id, label, pro?, fullWidth? }`.
- Tienda: `src/lib/productLayout.ts:19-32` (`KNOWN_ELEMENT_IDS`) + `src/lib/productLayout.ts:63-70` (`FULL_WIDTH_IDS`).
- Persistencia: `catalog_settings.product_layout = { right_column: string[], below_product: string[] }`.
- Render: `BelowProductBlocks` en `src/pages/ProductDetail.tsx:53-119` — un `switch` por token.

**Es un registro distinto de `SECTIONS`.** No comparte tipo, ni key, ni flag: `reels` figura en los dos lugares pero como dos entradas independientes (`SECTIONS` con `settingKey: 'section_reels'`, y `PRODUCT_ELEMENTS` con `id: 'reels'`, `fullWidth: true`), y son **dos pools de datos distintos** de la misma tabla (`placement='home'` vs `placement='product'`, separados por un CHECK en la DB — ver punto 8).

⚠️ **Trampa documentada** en `productLayout.ts:13-21` (admin): el storefront **ignora `right_column` por completo** (Fase 0 híbrida, ver `src/lib/productLayout.ts:7-11`). Un bloque `fullWidth` arrastrado a la columna derecha **desaparece de la tienda sin ningún aviso**. Ya pasó con `reels`.

### 2.2 Sistema B — secciones custom (`catalog_custom_sections`)

Este es el sistema que **sí** monta el mismo componente en los dos lados.

- Tipos: `src/lib/types.ts:30-44` (`CustomSectionType`: banner, text, marquee, products, countdown, cta, split, video, faq, divider, categories) y `procurva2/types.ts:1731`.
- Dónde vive cada una: `page_context` (`'home' | 'product_detail'`, `src/lib/types.ts:45`) y, dentro del detalle, `content.slot` (`ProductDetailSlot`, `src/lib/types.ts:46-56`): `above_description`, `below_description`, `below_gallery`, `below_product`, `right_column`.
- Home: `src/pages/Home.tsx:146-192` — `switch (cs.section_type)` que arma `nodes['custom:<uuid>']`.
- Ficha: `src/components/ProductDetailCustomSlot.tsx:19-76` — `CustomSectionNode` (switch) + `ProductDetailCustomSlot` (filtra por slot).
- Hooks separados: `src/hooks/useCustomSections.ts:23` (home) y `src/hooks/useProductDetailCustomSections.ts:22` (detalle, filtra `page_context='product_detail'`).

### 2.3 Respuesta a tu pregunta

**Podés escribir UN componente y montarlo en los dos lugares, y el repo ya tiene el mecanismo para la presentación distinta:** el prop `variant: CustomSectionVariant` (`'default' | 'column'`, `src/lib/types.ts:58-62`), que `CustomSectionNode` propaga hasta el componente concreto (`ProductDetailCustomSlot.tsx:64-72`). El motivo está escrito en `ProductDetailCustomSlot.tsx:44-47`: la columna derecha mide **466px en desktop y 267px a 768px**, contra el ancho completo de los otros slots.

**Pero hoy sólo 4 de los 11 tipos están montados en la ficha** (`ProductDetailCustomSlot.tsx:25-36`): `banner`, `text`, `marquee`, `faq`. El resto cae en `default: return null`. O sea: **el switch del home y el switch de la ficha son dos listas paralelas que ya divergieron**. Si hacés "Dónde encontrarnos" como tipo custom, tenés que agregarlo en los **dos** switches o no aparece en la ficha (y sin error: devuelve `null` en silencio).

Los dos switches llevan el mismo comentario explicando por qué son `switch` y no ternario: un `section_type` que el build no conoce **no debe renderizar nada**; con el ternario anterior caía en el `else` y se dibujaba como sección de texto vacía.

**Recomendación de diseño (mía, no verificada contra tu intención):** los datos (`locations`) van en tabla propia; la *sección* conviene modelarla como **tipo custom nuevo** (`section_type: 'locations'`), porque eso te da gratis: entrada en `sections_order`, arrastre, `page_context` home/ficha, slots, `variant` y la posibilidad de repetirla. Una sección fija sólo puede existir una vez y sólo en el home.

---

## 3. FOOTER

**Configurable por tenant, pero con estructura rígida y sin punto de extensión.**

- Componente: `src/components/Footer.tsx`. Se monta en `src/components/Layout.tsx:51`, **fuera de las rutas** — no pasa por `sections_order` ni por el mapa `nodes` del home.
- Estructura: 4 columnas **hardcodeadas** — Marca (`:64-81`), Tienda (`:83-92`, links fijos a `/productos`, `/categorias`, `/carrito`), Contacto (`:94-103`), luego métodos de pago (`:105-121`) y bottom bar (`:123-135`).
- Datos, todos desde `useStore()` (`Footer.tsx:50`): `logoUrl`, `name`, `footerText`, `instagramUrl`, `facebookUrl`, `whatsapp`, `contactEmail`, `paymentMethods`, `showPoweredBy`.
- Panel del admin: `procurva2/components/catalog/editor/sections/EditFooter.tsx` — sólo edita **redes sociales** (`social_instagram`, `social_tiktok`, PRO) y **políticas de la tienda** (`envio_politica`, `cambios_politica`…), que en realidad se muestran en la ficha de producto, no en el footer.
- `footer` figura en `SECTION_META` (`sections.ts:44`) como sección del editor, pero **no tiene `home: true` en `SECTIONS`**, así que no entra en `HOME_KEYS` ni se arrastra.

**Punto de extensión: no encontrado.** No hay slot, ni render de custom sections, ni columna configurable. Para poner "Dónde encontrarnos" en el footer hay que **abrir `Footer.tsx` a mano**: o agregar una quinta columna condicional, o convertir el bloque "Contacto" en algo que liste ubicaciones.

⚠️ La columna "Contacto" del footer ya muestra WhatsApp y email del tenant. Si cada ubicación trae su propio teléfono/WhatsApp, decidí explícitamente cuál manda: hoy `config.whatsapp` es **uno solo por tienda**.

---

## 4. FETCHES al montar el storefront

### 4.1 El fetch raíz

`src/context/StoreProvider.tsx:175` → RPC **`get_storefront_by_slug`** (y `verify_storefront_password` para la tienda mayorista protegida, `:42`). Devuelve el `ResolvedStorefront` con `settings`, que `normalizeStoreConfig` convierte en `StoreConfig`. **Todo lo que viva en `catalog_settings` llega acá, sin query extra.**

### 4.2 Todo lo demás son queries directas por hook

Las 20 lecturas de tabla del storefront:

| archivo:línea | tabla |
|---|---|
| `src/hooks/useBanners.ts:17` | `catalog_banners` |
| `src/hooks/useCategories.ts:39` | `catalog_category_order` |
| `src/hooks/useComplementarios.ts:56` | `product_recommendations` |
| `src/hooks/useCustomSections.ts:23` | `catalog_custom_sections` (home) |
| `src/hooks/useOutfits.ts:31,56,69` | `catalog_outfits`, `catalog_outfit_items`, `products` |
| `src/hooks/useProduct.ts:45,55` | `products` |
| `src/hooks/useProductDetailCustomSections.ts:22` | `catalog_custom_sections` (ficha) |
| `src/hooks/useProductVariants.ts:32` | `product_variants` |
| `src/hooks/useProducts.ts:110` | `products` |
| `src/hooks/useRecommendations.ts:49` | `product_recommendations` |
| `src/hooks/useReels.ts:44` | `catalog_reels` |
| `src/hooks/useStories.ts:17` | `catalog_stories` |
| `src/hooks/useTestimonials.ts:17` | `catalog_testimonials` |
| `src/context/CategoryTiersContext.tsx:49,54` | `category_volume_tiers`, `catalog_category_order` |
| `src/context/PromotionsContext.tsx:81` | `ecommerce_promotions` |
| `src/context/WholesalePricingContext.tsx:56-97` | 6 tablas de precios mayoristas |

**`catalog_reels` agregó una query nueva.** No se colgó de nada.

### 4.3 El patrón que debería seguir una tabla nueva

`useReels.ts` es la referencia más completa y vale copiarla entera:

1. **`companyId` desde `useStoreStatus()`** (`:31`), no desde props. Si no está, corta.
2. **Guard de `cancelled`** para no setear estado tras desmontar (`:37,55,68`).
3. **Filtro de canal en cliente**: `catalog_type in ('both', retail|wholesale)` (`:51-52`). El canal ya lo resolvió `StoreProvider`.
4. **`is_visible = true`** en la query, no en el render.
5. **`order('sort_order')`**.
6. **Tolerancia a migración no aplicada** (`:56-63`): si la tabla no existe (`42P01`/`PGRST205`), devuelve lista vacía y la sección no se renderiza, **sin romper la página**. El comentario `:20-25` dice por qué: *"acá las migraciones se aplican a mano, y una pantalla rota por eso ya pasó antes"*.
7. El componente devuelve **`null` si no hay datos** (`ReelsSection.tsx:14`).
8. Si la sección tiene que estar arriba del fold, registrarse en el gate de primer paint con `useFirstPaintGate('<key>', isLoading)` (patrón en `Home.tsx:101-102`, `CategoriesSection.tsx:141`).

> **Para "Dónde encontrarnos":** el punto 6 no es opcional. Las migraciones de este proyecto **se aplican a mano** en el SQL Editor; si el hook nuevo no tolera la tabla ausente, el deploy del código rompe todas las tiendas hasta que corras el SQL.

---

## 5. HEAD del storefront

- **Estático**: `index.html:4-12` — `charset`, `viewport`, `theme-color`, `description` genérica ("Tienda online"), `robots`, `og:type`, `og:title`, `<title>Tienda</title>`. Son placeholders que el runtime pisa.
- **Dinámico**: `src/lib/seo.ts` — `applySeo()` (`:53-89`) manipula `document.head` imperativamente. Escribe `title`, `description`, `robots`, OG (`og:title`, `og:description`, `og:type`, `og:url`, `og:site_name`, `og:image`), Twitter Card y `<link rel=canonical>`. El comentario `:1-5` aclara que **siempre se escribe el set completo** (last-write-wins) para que navegar entre páginas resetee bien.
- **Wrapper React**: `src/components/Seo.tsx` — componente que no renderiza nada, sólo corre `applySeo` en un `useEffect`. Se usa en Home (`Home.tsx:204`), ProductDetail, ProductList, CategoriesIndex, etc.
- Canonical: `https://{slug}.procurva.app{path}` (`seo.ts:24-31`), con fallback a `window.location.origin` sin slug.

### JSON-LD: **no encontrado**

`grep -rn "application/ld+json|jsonLd|schema.org" src index.html` → **cero resultados**. No hay ni `Product`, ni `Organization`, ni `BreadcrumbList`. `LocalBusiness` sería el primero del repo.

**Implicancia:** hay que construir el mecanismo, no sólo el objeto. `setMeta`/`setLink` (`seo.ts:32-50`) no sirven: un `<script type="application/ld+json">` es un nodo con contenido de texto, no un tag con atributo. Necesitás una función hermana (algo como `setJsonLd(id, obj)`) que **borre el nodo anterior antes de escribir** — si no, navegando entre páginas se acumulan bloques JSON-LD contradictorios.

⚠️ **Advertencia sobre el valor SEO:** el storefront es un **SPA sin SSR** (`index.html` sirve un shell y `App.tsx` hidrata; no encontré ninguna configuración de prerender). El JSON-LD inyectado por JS lo lee Googlebot, pero **no** lo leen la mayoría de los otros crawlers ni las previews de WhatsApp/Facebook. Para `LocalBusiness` — que es justamente lo que Google usa para el panel local — sirve; para el resto, no esperes mucho.

---

## 6. Versión de la key de sessionStorage

**Valor exacto hoy** — `src/context/StoreProvider.tsx:66`:

```ts
const cacheKey = (slug: string) => `procurva_store_config_v10:${slug}`;
```

Se subió a **v10** el 2026-08-09 (commit `66bd002`), al sumar `showVariantColors`. Historial en el comentario `:49-65`: v5 (resolución vía RPC), v7 (`sectionMaxItems`), v8 (`sectionHeadings`), v9 (`heroCta`/`heroMode`), v10 (`showVariantColors`).

Hay una **segunda** key, sin versión: `procurva_wholesale_unlock:{slug}` (`:68`), que marca que la tienda mayorista protegida ya fue desbloqueada. **No la toques al bumpear**: si la invalidás, a todos los visitantes de una tienda mayorista les vuelve a aparecer el gate de contraseña.

### Qué hay que tocar para bumpear (y por qué casi no rompe nada)

1. Un solo lugar: `StoreProvider.tsx:66`, `v10` → `v11`, **actualizando el comentario de arriba** con qué campo lo motivó (la convención del archivo es dejar el historial).
2. **Nada más.** `cacheKey` se usa sólo en `readCache` (`:79`), `writeCache` (`:91`) y el borrado ante error (`:203`).

**Impacto en visitantes recurrentes: nulo o casi.** El cache es **`sessionStorage`** (muere al cerrar la pestaña), y la estrategia es **stale-while-revalidate**: sirve lo cacheado para el primer paint y **siempre** revalida contra la RPC (comentario `:47-52`). Al bumpear, lo único que pasa es que el primer paint de esa sesión espera la RPC en vez de pintar instantáneo. No hay pérdida de datos ni sesión.

**Cuándo es obligatorio bumpear:** cuando agregás un campo a `StoreConfig` que la UI lee **sin guarda**. El comentario `:60-65` da el caso concreto: una entrada v7 no traía `sectionHeadings` y el primer paint reventaba leyendo `sectionHeadings.featured` sobre `undefined`.

> **Para "Dónde encontrarnos":** si los datos van en **tabla propia** (recomendado), **no hay que bumpear nada** — la tabla no entra en `StoreConfig`. Sólo bumpeás si sumás flags de presentación a `catalog_settings` (ej. `section_locations`, `locations_display_mode`) que el render lea sin default.

---

## 7. MÉTODOS DE ENVÍO y "retiro en local" — **acá está el riesgo de duplicar la dirección**

### 7.1 Cómo están modelados

**No hay tabla de métodos de envío.** Viven como JSONB en **`companies.settings.shippingMethods`** (ojo: `settings`, no `catalog_settings`).

- Tipo normalizado: `src/lib/shipping.ts:15-39` (`ShippingOption`), con `kind: 'local-pickup' | 'home' | 'branch'` (`:12`).
- Mapeo crudo → normalizado: `toShippingOption` (`shipping.ts:154-179`).
- Un método tipo "empresa" (Correo, Andreani…) se **expande en dos opciones** (domicilio + sucursal) con precio independiente: `expandMethod` (`shipping.ts:187-224`).
- Filtro por código postal: `parsePostalCodeRanges` (`:47`) y la lógica de cobertura (`:80-125`). **El retiro en local nunca se filtra por CP** (`:83`: `if (!m.requiresAddress) return true`).

### 7.2 Sí, "retiro en local" ya existe

Un método con `isPickup === true` o `type === 'retiro'` (`shipping.ts:155`). Y **ya tiene los tres campos que ibas a poner en la tabla nueva**:

```ts
pickupAddress?: string;   // shipping.ts:23  — dirección del local
openingHours?: string;    // shipping.ts:25  — horarios de atención
readyTime?: string;       // shipping.ts:27  — "listo para retirar"
```

### 7.3 De dónde sale la dirección que ve el comprador

**Cadena completa, verificada:**

1. **Se carga** en el ERP: `procurva2/components/CompanySettings.tsx:2798` — un `<textarea name="pickupAddress">` con placeholder `"Ej: Av. Pellegrini 1234, Rosario"`. Se guarda vía `addShippingMethod` / `updateShippingMethod` (`:2734-2736`) dentro del método de envío.
2. **Se guarda** en `companies.settings.shippingMethods[].pickupAddress`.
3. **Se expone al público** por la RPC `get_catalog_shipping_methods` (definida en `procurva2/supabase/migrations/20260605_secure_companies_settings_anon.sql:72-85`), `SECURITY DEFINER`, que devuelve `settings->'shippingMethods'` **sólo si `catalog_enabled = true`**. Existe porque a `anon` se le **revocó** el SELECT sobre `companies.settings` (`:42-43`) — la RPC es la única puerta.
4. **La lee** el storefront: `src/lib/shipping.ts:231-243` (`fetchShippingOptions`) y `src/pages/Checkout.tsx:334`.
5. **Se le muestra** al comprador en el checkout y viaja al pedido: `src/lib/checkout.ts:73` (`'Retiro en local'`), `src/lib/orders.ts:257-259` (`shipping_method: 'Retiro'`, `is_pickup: !hasAddress`).

### 7.4 Qué significa esto para tu diseño

**La dirección del local ya vive en un lado, y ese lado es el que el checkout lee hoy.** Si la tabla nueva nace con su propia dirección, quedan **dos fuentes desincronizadas desde el día uno**: el comercio se muda, actualiza "Dónde encontrarnos", y el checkout le sigue diciendo al comprador la dirección vieja.

Tres caminos, en orden de preferencia:

| opción | qué implica | riesgo |
|---|---|---|
| **A. `locations` es la fuente de verdad; el método de retiro la referencia** por `location_id` | hay que tocar `CompanySettings.tsx` (que el campo pase a ser un selector), la RPC `get_catalog_shipping_methods` (que resuelva la dirección con un join) y migrar los `pickupAddress` existentes | el más trabajo, pero es el único que **no** deja dos direcciones |
| **B. `locations` con `available_for_pickup boolean`, y el checkout se migra después** | la tabla nace lista; mientras tanto el checkout sigue leyendo `pickupAddress` | **hay ventana de desincronización** hasta que migres. Mitigable mostrando la dirección de `locations` en el checkout desde el principio |
| **C. Dejar los dos sistemas separados** | cero trabajo ahora | es exactamente lo que dijiste que no querés |

Datos para decidir: `pickupAddress` es **texto libre** (un `textarea`), no tiene lat/lng, ni ciudad, ni provincia estructurados. Para el mapa (facade) vas a necesitar coordenadas o una query geocodificable — o sea que **la tabla nueva tiene información que el JSONB no puede representar**, lo cual empuja hacia la opción A: la tabla como fuente de verdad y el método de envío apuntándole.

---

## 8. RLS de `catalog_reels` — el patrón a copiar

Archivo: `procurva2/supabase/migrations/20260740_catalog_reels.sql`. **Ojo:** el header (`:18-21`) avisa que **no se aplica automáticamente** — hay que correrla a mano en el SQL Editor.

### Dueños (`authenticated`) — cuatro policies, una por verbo

```sql
company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
```

Ese es el **predicado canónico del repo** (`:73-76`). Va en `USING` para SELECT/UPDATE/DELETE y en `WITH CHECK` para INSERT/UPDATE.

### Público (`anon`) — la parte importante

```sql
CREATE POLICY "Public can view visible reels of enabled catalogs" ON public.catalog_reels
  FOR SELECT USING (
    is_visible = true
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = catalog_reels.company_id AND c.catalog_enabled = true
    )
  );
```

**El comentario `:103-109` explica por qué es un `EXISTS` PLANO y no un helper:**

> MISMO patrón que `product_media` (20260707): un EXISTS PLANO sobre companies, NO un helper SECURITY DEFINER como `get_my_company_id()`. Es a propósito: si la policy llamara a un helper y anon no tuviera EXECUTE, la query entera aborta con 42501 y el storefront muestra "Catálogo no disponible".

Esto es la gotcha documentada en `CLAUDE.md`: Postgres evalúa **todas** las policies permisivas de SELECT y las OR-ea, así que **una sola** policy que llame a un `SECURITY DEFINER` sin `GRANT EXECUTE TO anon` tumba la query completa. Con `EXISTS` plano no hay GRANT del que depender.

### Grants de tabla (explícitos, no heredados)

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_reels TO authenticated;
GRANT SELECT ON public.catalog_reels TO anon;
```

### Copiá también estas tres cosas que no son RLS

1. **Trigger de `updated_at`** (`:58-70`): función `touch_<tabla>_updated_at` + trigger `BEFORE UPDATE`.
2. **Índices por ruta de lectura real**, parciales (`:48-56`). Para locations: `(company_id, sort_order) WHERE is_visible`.
3. **Bloque de VERIFICACIÓN al final** (`:126-132`), con los `SELECT` para confirmar que la migración quedó bien aplicada. Es convención del repo y con migraciones manuales es lo único que te dice si corrió.

> **Para la tabla nueva:** el patrón se copia **tal cual**. La única decisión propia es que **teléfono y dirección quedan legibles por `anon`** para cualquier tienda con `catalog_enabled = true` — que es exactamente lo que querés (son datos que el comercio publica), pero conviene que el comercio lo entienda: lo que cargue ahí es **público y scrapeable**, no un dato interno.

---

## Riesgos y sorpresas

Cosas que encontré de paso y conviene saber antes de arrancar.

**R1 — Las listas paralelas son la fuente crónica de bugs de este repo.** Aparecen documentadas al menos cinco veces: `SECTIONS` vs `HOME_KEYS` (`homeSections.ts:14-24`, dejó `stories` y `reels` invisibles), `DEFAULT_PRODUCT_LAYOUT` duplicado en los dos repos (`src/lib/productLayout.ts:35-43`), `FULL_WIDTH_IDS` vs `fullWidth: true`, el switch del home vs el de la ficha, y `DEFAULT_SECTION_ORDER` vs `nodes`. **Cada vez que agregues la sección a un lugar, buscá el espejo.** El archivo `src/lib/productLayout.ts:41-42` incluso pide explícitamente: *"Si tocás el orden del render legacy en ProductDetail.tsx, actualizá los dos"*.

**R2 — La columna derecha de la ficha NO se consume.** `src/lib/productLayout.ts:7-11`: el storefront sólo usa el orden de `below_product`. Si montás "Dónde encontrarnos" en `right_column`, **desaparece sin aviso**. Ya pasó con `reels`.

**R3 — Sólo 5 de 12 tipos custom están montados en la ficha.** `ProductDetailCustomSlot.tsx` monta `banner`, `text`, `marquee`, `faq` y —desde la fase 1 de "Dónde encontrarnos"— `locations`. El resto devuelve `null` en silencio.

**Los 7 que siguen faltando** (creados desde la ficha, se guardan bien y no se ven nunca):

| tipo | está en el home | está en la ficha |
|---|---|---|
| `products` (grilla de productos) | sí | **no** |
| `countdown` (cuenta regresiva) | sí | **no** |
| `cta` (botón) | sí | **no** |
| `split` (texto con imagen) | sí | **no** |
| `video` | sí | **no** |
| `divider` (separador) | sí | **no** |
| `categories` (grilla de categorías) | sí | **no** |

Ojo con `products`, `split` y `categories`: no alcanza con sumar el `case`, hay que ver cómo se comportan en `variant="column"` (267px a 768px). `divider` y `countdown` son los baratos.

**R3.b — Los dos hooks de secciones custom ordenan distinto.** `useCustomSections.ts:29` (home) ordena por `created_at` y `useProductDetailCustomSections.ts:29` (ficha) por `position`. En el home no se nota porque el orden real lo manda `sections_order`; en la ficha sí manda `position`. Anotado, no unificado: cambiar el criterio del home puede reordenarle las secciones a los tenants que ya tienen varias.

**R4 — Las migraciones se aplican A MANO.** Está escrito en la migración de reels (`:18-21`) y en `CLAUDE.md`. Consecuencia directa: **el hook nuevo tiene que tolerar que la tabla no exista** (`useReels.ts:56-63`), o el deploy del código rompe todas las tiendas hasta que corras el SQL. En el índice de memoria del proyecto hay una decena larga de migraciones marcadas "SIN aplicar" — no es un caso hipotético.

**R5 — `anon` no puede leer `companies.settings`.** Fue revocado (`20260605_secure_companies_settings_anon.sql:42-43`). Si en algún momento pensabas guardar las ubicaciones en `settings` en vez de tabla propia, **no las vas a poder leer desde la tienda** sin escribir otra RPC `SECURITY DEFINER`. Un argumento más para la tabla.

**R6 — El gate de primer paint puede tapar la tienda entera.** `FirstPaintContext` retiene el render hasta que todos los gates registrados resuelven (`Home.tsx:101-102`, `CategoriesSection.tsx:141`, `Hero.tsx:51`). Si registrás "Dónde encontrarnos" en el gate y su fetch queda colgado, **la tienda no pinta**. Para una sección que va abajo del fold, no la registres.

**R7 — El mapa con patrón facade choca con la CSP y con el `object-src`… pero eso no lo pude verificar.** No encontré configuración de CSP en el repo del storefront (ni en `vercel.json` ni en `index.html`). Lo que **sí** vale mirar antes: el `<iframe>` del mapa dentro del editor visual del admin, que ya renderiza la tienda en un iframe — vas a tener un iframe adentro de otro iframe, y Google Maps a veces se porta raro ahí.

**R8 — Hay un `AUDIT_STOREFRONT.md` previo en la raíz del repo**, citado desde `useReels.ts:24` ("ver AUDIT_STOREFRONT.md, riesgo R7"). No lo leí para esta auditoría; si arrastra riesgos vigentes, conviene cruzarlo con esto antes de diseñar.

**R9 — El texto de la sección va a chocar con el sistema de encabezados que se acaba de tocar.** Si "Dónde encontrarnos" es sección fija con `editableTitle: true`, hereda el comportamiento de tres estados de `resolveSectionHeadings` (`src/lib/storeConfig.ts:96-135`): clave ausente = default, clave vacía = **no se muestra nada**, con texto = ese texto. Y si el título queda vacío, `SectionHeader` tampoco pinta la volanta (`src/components/SectionHeader.tsx:20-36`). Es el comportamiento correcto, pero tenelo en cuenta al definir el default.

**R10 — Un dato al pasar sobre el footer y el WhatsApp:** `config.whatsapp` es **uno solo por tienda** y ya se usa en el footer (`Footer.tsx:52`), en el botón flotante y en el checkout (`CheckoutResult.tsx:174`). Si cada ubicación trae su propio WhatsApp, vas a tener dos números conviviendo en la misma pantalla. Decidí de antemano cuál gana en cada superficie.
