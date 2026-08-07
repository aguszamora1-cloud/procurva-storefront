# Audit — Secciones del home + badge "Nuevo" (`procurva-storefront`)

Auditoría de solo lectura. Fecha: 2026-08-03. Repo: `procurva-storefront` (storefront público, repo separado de `procurva2`).
Toda afirmación lleva `archivo:línea`. Lo que no pude respaldar está marcado como **NO CONFIRMADO**.

---

## 1. Respuestas cortas (las 5 bloqueantes)

| # | Pregunta | Respuesta | Evidencia |
|---|---|---|---|
| a | ¿Contra qué columna se evalúa el badge "Nuevo"? | **`products.created_at`**. `last_restock_at` no aparece en ninguna línea de `src/`. | `src/hooks/useProductBadges.tsx:90-92` |
| b | Default de `window_days` acá | **14** en la normalización, y **14** otra vez como fallback defensivo en el hook. Coincide con el panel. | `src/lib/storeConfig.ts:275`, `src/hooks/useProductBadges.tsx:81` |
| c | ¿Hay límite hoy? | **Sí: 12** (`SECTION_LIMIT`), client-side, igual para las tres secciones. Ojo: se aplica **antes** de explotar las cards por color, así que una sección puede pintar más de 12 cards. | `src/pages/Home.tsx:82`, `src/pages/Home.tsx:92`, `src/components/home/ProductsSection.tsx:19` |
| d | Regla automática de `new_arrivals` | **No hay regla de membresía**: el relleno es *todo el catálogo* en su orden base (con stock primero, después `created_at DESC`), cortado en 12. No existe ventana por días ni nada equivalente a Ofertas. | `src/pages/Home.tsx:124-127`, `src/hooks/useProducts.ts:108`, `src/hooks/useProducts.ts:137-139` |
| e | ¿Se leen `is_featured` / `is_new_arrival`? | **Sí**, pero **no en el home**: solo en el listado `/productos`, como criterio de desempate del orden. En `Home.tsx` no se tocan. | `src/pages/ProductList.tsx:113-114`, `src/pages/ProductList.tsx:122-123`, `src/hooks/useProducts.ts:32` |

---

## Bloque A — Cómo se arma cada sección del home

### Componentes y hooks involucrados

`hooks/useFeaturedSections.ts` **existe y es correcto**, pero *no* renderiza nada: solo trae los pins. El armado real de las tres secciones vive en la página del home.

- `src/hooks/useFeaturedSections.ts:47-50` — llama `get_home_section_pins(p_company_id, p_channel)`; el canal se deriva de `storeType` (`wholesale` | `retail`) en `:40`.
- `src/hooks/useFeaturedSections.ts:62-70` — agrupa las filas por `row.section` en tres arrays de `product_id` (`featured`, `newArrivals`, `offersOrder`), respetando el orden que devuelve la RPC. No reordena por `pin_position` client-side: confía en el `ORDER BY` de la RPC.
- `src/pages/Home.tsx:114-141` — acá se arman las tres listas.
- `src/components/home/ProductsSection.tsx` — componente de render, compartido por las tres.
- `src/hooks/useTopSelling.ts` — ranking de ventas para la regla automática de Destacados (`get_top_selling_products`, `p_limit: 200` en `:32`).

La combinación pins + auto es una sola función, común a las tres secciones:

```
src/pages/Home.tsx:87-93
function buildSection(products, pinIds, autoOrdered) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const pinned = pinIds.map((id) => byId.get(id)).filter(Boolean);   // pins que existen en el catálogo cargado
  const pinnedSet = new Set(pinned.map((p) => p.id));
  const rest = autoOrdered.filter((p) => !pinnedSet.has(p.id));      // dedup
  return [...pinned, ...rest].slice(0, SECTION_LIMIT);               // 12
}
```

Respuestas transversales: **siempre es mezcla** (pins arriba + relleno automático), **siempre deduplica** por id (`Home.tsx:90-91`), y **la regla automática corre siempre**, no solo cuando faltan pins — el relleno se concatena aunque haya 12 pins, y recién ahí lo corta el `slice`. Un pin que apunta a un producto que ya no está en el catálogo cargado (invisible, precio 0, borrado) se descarta silenciosamente (`Home.tsx:89`).

### `featured` (Destacados)

- Membresía: **mezcla**. Pins de la sección `featured` + relleno con *todo el catálogo*.
- Regla automática: orden por ranking de unidades vendidas all-time; los productos sin ventas caen al final con `Number.MAX_SAFE_INTEGER` y ahí adentro quedan en el orden base de `products`.
  ```
  src/pages/Home.tsx:115-119
  const auto = products.slice().sort((a, b) => {
    const ra = top.rank.has(a.id) ? top.rank.get(a.id) : Number.MAX_SAFE_INTEGER;
    const rb = top.rank.has(b.id) ? top.rank.get(b.id) : Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
  ```
- El ranking viene de `get_top_selling_products(p_company_id, p_limit: 200)` (`src/hooks/useTopSelling.ts:30-33`), convertido a `Map<product_id, rank>` en `:40-41`. Si la RPC falla, `rank` queda vacío y el orden colapsa al orden base (recencia). Solo hay `console.warn` (`:36`), sin señal visible.

### `new_arrivals` (Nuevos ingresos)

- Membresía: **mezcla**, pero con relleno **sin filtro alguno**:
  ```
  src/pages/Home.tsx:124-127
  const newArrivals = useMemo(
    () => buildSection(products, fs.newArrivals, products),   // <- el "auto" es el catálogo entero
    [products, fs.newArrivals],
  );
  ```
- Regla automática: el orden base del array `products`, que es:
  1. `ORDER BY created_at DESC` en la query (`src/hooks/useProducts.ts:108`),
  2. re-ordenado después con un sort estable que manda los sin stock al fondo (`src/hooks/useProducts.ts:137-139`).

  O sea: **con stock primero, y dentro de cada grupo `created_at DESC`**. No hay ventana de días, ni uso de `last_restock_at`, ni filtro por "novedad".
- Consecuencia práctica: si el comercio no pinea nada, "Nuevos ingresos" muestra los 12 productos más recientes con stock — que en un catálogo estático son *los mismos* que salen en Destacados si tampoco hay ventas registradas. La sección nunca queda vacía mientras haya productos.

### `offers` (Ofertas)

Ver Bloque C, tiene su propia sección.

### ¿Qué pasa si una sección queda en cero?

No queda ningún título colgado: `ProductsSection` corta antes de renderizar el `<section>`.

```
src/components/home/ProductsSection.tsx:19-20
const cards = useMemo(() => toCatalogCards(products), [products]);
if (cards.length === 0) return null;
```

Ofertas además tiene un guard redundante aguas arriba (`config.sections.offers && !isLoading && offers.length > 0`, `src/pages/Home.tsx:171`); Destacados y Nuevos ingresos no lo tienen y dependen únicamente del `return null` del componente.

Detalle de estados de carga, inconsistente entre las tres: Destacados pinta skeleton mientras `isLoading` (`Home.tsx:158-161`), mientras que Nuevos ingresos y Ofertas directamente no se renderizan (`Home.tsx:164`, `Home.tsx:171`). En la primera carga sin cache se ve un solo skeleton y después aparecen las otras dos. Mitigado en parte por el gate de primer paint (`Home.tsx:109-110`).

---

## Bloque B — Límite y corte

- **Límite hoy: sí, 12**, constante única para las tres secciones: `const SECTION_LIMIT = 12;` (`src/pages/Home.tsx:82`), aplicada en `src/pages/Home.tsx:92`. No hay corte por CSS ni por `max-height` en la grilla.
- **Bug latente del límite**: el `slice(0, 12)` corta *productos*, pero `ProductsSection` después explota cada producto con `display_variants_separately` en una card por color (`src/components/home/ProductsSection.tsx:19` → `src/lib/utils.ts:145-165`). Con productos multicolor, una sección de 12 productos puede renderizar 30+ cards. El límite real de la vidriera no es 12 items visibles.
- **Grilla, no carrusel**: `grid grid-cols-2 ... lg:grid-cols-4` (`src/components/home/ProductsSection.tsx:24`). Dos breakpoints: **2 columnas** en mobile/tablet, **4** desde `lg` (1024px). Mismo criterio que el grid del catálogo (`src/components/ProductGrid.tsx:55`). Con 12 productos: 3 filas en desktop, 6 en mobile.
- **"Ver más"**: no existe un botón propio de la sección, pero sí un link **"Ver todo"** en el encabezado, que las tres secciones pasan apuntando a `/productos`:
  - `src/components/SectionHeader.tsx:32-39` (el `<Link>`, `linkText ?? 'Ver todo'`),
  - `src/pages/Home.tsx:161`, `:165`, `:172` — las tres pasan `linkTo="/productos"`, sin querystring. O sea: desde Ofertas, "Ver todo" lleva al catálogo completo sin filtrar por ofertas.
- **Cuánto se baja de la base**: **el catálogo entero**. `useProducts` hace un SELECT sin `.limit()` ni `.range()`:
  ```
  src/hooks/useProducts.ts:101-108
  supabase.from('products').select(columns)
    .eq('company_id', companyId)
    .eq('catalog_visible', true)
    .gt(priceCol, 0)                      // retail_price o wholesale_price según canal
    .order('created_at', { ascending: false });
  ```
  Trae además todas las variantes anidadas (`product_variants ( size, color, stock, image_url )`, `src/hooks/useProducts.ts:30`). **El corte es 100% client-side.** El único límite server-side del home es el `p_limit: 200` del ranking de ventas (`src/hooks/useTopSelling.ts:32`), que no limita productos mostrados sino la profundidad del ranking.
- El payload se cachea en `sessionStorage` con versión `v1` (`src/hooks/useProducts.ts:44-46`), patrón stale-while-revalidate.

---

## Bloque C — La sección "Ofertas" en detalle

### Cómo determina la membresía

La membresía **se deriva de las promociones vigentes**, no del panel. El código completo:

```
src/pages/Home.tsx:132-141
const offers = useMemo(() => {
  const refPrice = (p) => config.storeType === 'wholesale' ? p.wholesale_price ?? 0 : p.retail_price ?? 0;
  const discPct  = (p) => priceFor(refPrice(p), p).discountPct ?? 0;
  const inPromo    = products.filter((p) => promoForProduct(p) !== null);   // <- MEMBRESÍA
  const inPromoIds = new Set(inPromo.map((p) => p.id));
  const auto       = inPromo.slice().sort((a, b) => discPct(b) - discPct(a));  // <- ORDEN AUTO
  const pinIds     = fs.offersOrder.filter((id) => inPromoIds.has(id));        // <- PINS FILTRADOS
  return buildSection(products, pinIds, auto);
}, [products, fs.offersOrder, promoForProduct, priceFor, config.storeType]);
```

`promoForProduct` es `bestPromoForProduct` (`src/context/PromotionsContext.tsx:91-94` → `src/lib/promotions.ts:284-305`). Un producto "está en oferta" si existe alguna promo que cumpla **todas** estas condiciones:

1. Cargada por el provider: `ecommerce_promotions` con `is_active = true` y vigencia abierta o vigente — `starts_at IS NULL OR <= ahora`, `ends_at IS NULL OR >= ahora` (`src/context/PromotionsContext.tsx:68-74`).
2. No es promo por cantidad (`isQuantityPromo` → `continue`, `src/lib/promotions.ts:291`).
3. Aplica al canal de la tienda: `channel` = `both` o igual al `storeType`; si no, el valor de descuento se fuerza a 0 y queda descartada (`src/lib/promotions.ts:74-89`).
4. Su valor de descuento para ese canal es `> 0` (`src/lib/promotions.ts:293`).
5. Alcanza al producto por scope `all` / `categories` (match por nombre de categoría) / `products` (match por id) (`src/lib/promotions.ts:92-103`).

Desempate entre varias promos aplicables: **scope más específico primero** (`products` > `categories` > `all`), y a igual scope, mayor valor de descuento (`src/lib/promotions.ts:297-301`).

### Cómo se aplican los pins encima

- **Un pin que ya no califica se cae**: `fs.offersOrder.filter((id) => inPromoIds.has(id))` (`src/pages/Home.tsx:139`). El pin **no fuerza** que el producto aparezca en Ofertas; solo declara posición. Es exactamente el patrón "membresía derivada + pins solo para orden".
- **Un producto que califica pero no está pineado va después de todos los pineados**, ordenado por **mayor porcentaje de descuento descendente** (`src/pages/Home.tsx:138`). El `%` se calcula con `priceFor(refPrice(p), p).discountPct`, es decir sobre el precio de referencia del canal (`wholesale_price` en mayorista, `retail_price` en minorista) — nótese que en minorista usa `retail_price`, no el precio principal de tarjeta que muestra la card (ver Hallazgos).
- El corte a 12 y la deduplicación los hace `buildSection`, igual que las otras dos secciones.

### Qué habría que tocar para replicar el patrón en `new_arrivals`

Sin escribir código, los puntos exactos:

| # | Archivo / función | Qué cambia |
|---|---|---|
| 1 | `src/pages/Home.tsx:124-127` — `const newArrivals = useMemo(...)` | Es el único lugar donde hoy se decide la membresía. Reemplazar el segundo `products` (relleno = catálogo entero) por un array filtrado por la regla de días, y filtrar `fs.newArrivals` contra ese conjunto — mismo par de líneas que `offers` usa en `:136` y `:139`. |
| 2 | `src/lib/storeConfig.ts` (`normalizeStoreConfig`), bloque `sections` en `:183-201` o un bloque nuevo | Necesita exponer la ventana de días de la sección. Si se decide reusar `badges.new.windowDays` (ya normalizada en `:275`) no hace falta clave nueva; si va a ser independiente, sí (ver Bloque G). |
| 3 | `src/lib/types.ts:365-384` (`RawCatalogSettings`) y `src/lib/types.ts:632-649` (`StoreConfig.sections`) | Declarar la clave nueva en los dos tipos, a mano (no hay generación). |
| 4 | `src/hooks/useProducts.ts:24-32` (`COLS_BASE` / `PRODUCT_COLUMNS`) | Solo si la regla usa `last_restock_at`: hoy no se pide (ver Bloque H). Si usa `created_at`, ya viene (`:29`). |
| 5 | `src/hooks/useProducts.ts:44` (`CACHE_VERSION`) | Bump obligatorio si cambia el SELECT, o los visitantes recurrentes leen del cache un payload sin la columna nueva. |
| 6 | `src/pages/Home.tsx:163-166` (nodo `new_arrivals`) | Hoy no chequea `length > 0` porque la sección nunca queda vacía. Con membresía derivada sí puede quedar vacía: conviene alinear el guard con el de `offers` (`:171`), aunque `ProductsSection` ya la autooculta. |
| 7 | `src/pages/ProductList.tsx:110-117` (`case 'nuevos'`) | Si "Nuevos" pasa a ser membresía derivada, el orden del listado que hoy desempata con `is_new_arrival` queda incoherente con el home. |
| 8 | `src/hooks/useFeaturedSections.ts` | **Sin cambios.** Ya devuelve `newArrivals` como lista ordenada de ids; en el modelo derivado pasa a leerse como "solo orden", igual que `offersOrder`. |

---

## Bloque D — Badge "Nuevo" (bloqueante)

### Dónde se evalúa

Un solo lugar: `src/hooks/useProductBadges.tsx`. Lo consumen la card del listado (`src/components/ProductCard.tsx:41`, con `includeQuantityPromo: false`) y la ficha de producto.

### Contra qué columna se compara `window_days`

**Contra `products.created_at`.** Explícito:

```
src/hooks/useProductBadges.tsx:88-93
// Producto "nuevo": dado de alta dentro de la ventana configurada (en días).
const isNew = (() => {
  if (!product.created_at) return false;
  const days = (Date.now() - new Date(product.created_at).getTime()) / 86_400_000;
  return days >= 0 && days <= newWindowDays;
})();
```

`last_restock_at` **no existe en todo `src/`** (grep sin resultados), así que hoy es imposible que el badge lo mire. El producto que reingresa stock no vuelve a ser "Nuevo".

Nota menor: el cálculo usa la hora local del navegador contra un timestamp ISO, sin normalizar a `America/Argentina/Buenos_Aires`. Con ventanas de días el error de ±3h solo afecta el borde exacto de la ventana; lo dejo señalado, no es bloqueante.

### Defaults

| Clave | Default acá | Default del panel | ¿Coincide? |
|---|---|---|---|
| `badges.new.window_days` | **14** (`src/lib/storeConfig.ts:275`), más un segundo `?? 14` defensivo en `src/hooks/useProductBadges.tsx:81` | 14 | Sí |
| `badges.new.enabled` | **`false`** (`src/lib/storeConfig.ts:272`), más `?? false` defensivo en `src/hooks/useProductBadges.tsx:122` | `false` | Sí |

El normalizador de `window_days` rechaza 0 y negativos: `num = (v, d) => (typeof v === 'number' && v > 0 ? v : d)` (`src/lib/storeConfig.ts:256`). Si el panel permitiera guardar `window_days: 0` (intención: "desactivar"), acá se leería **14**, no 0. **NO CONFIRMADO** si el panel permite guardar 0 — no leí `procurva2` en esta auditoría.

### Prioridad de badges y tope visible

Vive en el orden de los `if` de `src/hooks/useProductBadges.tsx:97-125`, y el tope se aplica en `:144`.

Orden **real**, de mayor a menor:

1. `low_stock` — Últimas unidades (`:97-100`)
2. `free_shipping` — Envío gratis (`:101-104`)
3. Grupo descuento, excluyente entre sí: promo del comercio → promo por cantidad → `-X%` automático (`:107-116`)
4. **`custom` — etiqueta del catálogo del producto** (`products.catalog_badge_text`) (`:117-121`)
5. `new` — Nuevo (`:122-125`)

Diferencias con el contrato del panel: hay un **quinto badge (`custom`) que se cuela entre Descuento y Nuevo**, y el tope **no es 2 sino 1**:

```
src/hooks/useProductBadges.tsx:141-144
// UN SOLO badge por producto: gana el de mayor prioridad (ver el orden arriba).
// Antes se mostraban hasta 2 y quedaban combinaciones ruidosas...
return { outOfStock, badges: deduped.slice(0, 1), style, position, showIcons };
```

El comentario confirma que el tope de 2 existió y se bajó a 1 deliberadamente. Antes del corte hay un dedup por label normalizado (minúsculas, sin acentos, espacios colapsados) que descarta un badge manual con el mismo texto que uno automático (`:131-139`).

Efecto práctico para lo que viene: con el tope en 1, "Nuevo" es el **último** de cinco candidatos. Un producto recién dado de alta con poco stock, con envío gratis, en promo, o con etiqueta manual, **nunca** muestra "Nuevo".

### ¿Badge y sección comparten código o datos?

**No.** Explícito, sin matices:

- El badge lee `product.created_at` + `config.badges.new` (`src/hooks/useProductBadges.tsx:81`, `:90`, `:122`).
- La sección lee los pins de `get_home_section_pins` y rellena con el catálogo entero (`src/pages/Home.tsx:124-127`).
- No hay un solo símbolo compartido entre `useProductBadges.tsx` y `useFeaturedSections.ts` / el bloque `newArrivals` de `Home.tsx`.

Hoy pueden contradecirse: un producto puede estar en "Nuevos ingresos" (pineado o por relleno) sin badge "Nuevo" (más viejo que la ventana), y al revés — badge "Nuevo" sin estar entre los 12 de la sección.

---

## Bloque E — ¿Se leen las columnas huérfanas?

Grep de `is_featured` / `is_new_arrival` en `src/`, resultados completos:

| Archivo:línea | Qué hace |
|---|---|
| `src/hooks/useProducts.ts:32` | Las incluye en `PRODUCT_COLUMNS` del SELECT. |
| `src/hooks/useProducts.ts:34` | Las lista en `OPTIONAL_COLS_RE` — si la migración no está aplicada, el SELECT reintenta con `COLS_BASE`. |
| `src/lib/types.ts:143`, `:145` | Declaradas en la interfaz `Product`. |
| **`src/pages/ProductList.tsx:113-114`** | **Uso real**: orden "Más nuevos" — desempate con `is_new_arrival`. |
| **`src/pages/ProductList.tsx:122-123`** | **Uso real**: orden "Destacados" (el default del listado) — desempate con `is_featured`. |
| `src/hooks/useFeaturedSections.ts:8`, `src/pages/ProductList.tsx:97` | Solo comentarios. |
| `src/lib/categoryTiers.ts:4`, `:50` | Falso positivo: `is_featured` de un *escalón de categoría*, nada que ver con productos. |

**Sí se usan, y sí hay dos conjuntos compitiendo — pero no en el home.** En `/productos` el orden es de tres niveles:

```
src/pages/ProductList.tsx:120-125
const rank = new Map(featured.map((id, i) => [id, i]));
const ra = rank.has(a.id) ? rank.get(a.id) : a.is_featured ? featured.length : Infinity;
```

1. Pineados en el ERP, en el orden del panel;
2. los que tienen el flag `is_featured` / `is_new_arrival`, todos empatados en `featured.length`;
3. el resto, `Infinity`;
   y dentro de cada grupo, `created_at DESC` (`src/pages/ProductList.tsx:100-101`, `:115`, `:124`).

Como el panel escribe los flags pero no los lee, el nivel 2 es un conjunto **que solo el storefront ve** y que el comercio no puede inspeccionar desde ningún lado. En el home ese nivel no existe: `Home.tsx` no menciona los flags. Resultado: un producto con `is_featured = true` sin pin aparece adelante en `/productos` y en ninguna posición particular del home.

---

## Bloque F — Listado de productos

- **Ruta**: `/productos` → `ProductList` (`src/App.tsx:65`). Existe además `/categoria/:name` → `Category` (`src/App.tsx:68`) y `/categorias` (`:67`).
- **Querystring aceptada** (`src/pages/ProductList.tsx:38-46`):
  - `?categoria=<nombre>` — preselecciona una categoría en los filtros (`:39`, `:46`);
  - `?q=<texto>` — búsqueda por nombre / sku / marca / descripción, sin acentos ni mayúsculas (`:41`, `:80-84`);
  - `?orden=` — `destacados` (default) | `nuevos` | `precio_asc` | `precio_desc` | `az` (`:43`, `:103-127`, opciones del select en `:247-251`).
  - Los filtros de talle, color y precio son **estado local**, no viajan por URL (`:47-50`) — no son linkeables.
- **¿Filtro por destacados o novedades?** No como filtro. Existen solo como **criterios de orden** (`orden=destacados`, `orden=nuevos`). Un `?seccion=nuevos` que *recorte* el conjunto habría que agregarlo.
- **Paginación**: **no hay ninguna**. `ProductGrid` renderiza todas las cards de una (`src/components/ProductGrid.tsx:55-62`); lo único que mitiga el costo es el prefetch de imágenes por `IntersectionObserver` con `rootMargin: 600px` (`src/components/ProductGrid.tsx:12-43`) y el `priority` de las 4 primeras (`:59`). `Category` es igual, sin paginación (`src/pages/Category.tsx:52`).
- **¿`?seccion=nuevos` sin refactor?** **Sí, sin tocar ninguna query.** El filtrado es enteramente client-side sobre el array `products` que ya está en memoria: alcanza con leer el parámetro junto a los otros (`src/pages/ProductList.tsx:38-43`) y sumar un predicado al `useMemo` de `filtered` (`:77-94`). Para "nuevos por días" el dato ya está disponible (`created_at`, ver Bloque H). Lo que sí conviene mirar: hoy el conjunto de "nuevos" del listado (flag `is_new_arrival` + pins) y el del home no son el mismo, así que un `?seccion=nuevos` que replique la regla del home requiere unificar antes esa definición.

---

## Bloque G — Cómo agregar un setting nuevo sin romper nada

- **Dónde vive la normalización**: `normalizeStoreConfig(resolved: ResolvedStorefront): StoreConfig` en `src/lib/storeConfig.ts:68-374`. Único punto de entrada; lo llama `StoreProvider` en `src/context/StoreProvider.tsx:119` (y desde `unlock`, `:137`).
- **Cómo se resuelven los defaults**: clave por clave, con helpers que devuelven un fallback ante `undefined`, tipo equivocado o valor vacío:
  - `bool(v, fallback)` — `src/lib/storeConfig.ts:49-50`, solo acepta booleanos reales;
  - `str(v, fallback = '')` — `:46-47`, exige string no vacío tras `trim`;
  - `firstStr(...vals)` — `:53-59`, primera no vacía (patrón clave nueva ↔ clave legacy);
  - `num(v, d)` local del bloque de badges — `:256`, exige `> 0`.

  El JSONB parcial es el caso **normal**, no el excepcional: `const s = resolved.settings ?? {}` (`:69`) y a partir de ahí todo accede con optional chaining. Un tenant sin la clave nueva toma el default sin ningún camino de error. Precedente exacto de lo que vas a hacer: `section_offers` se agregó después y se lee con `bool(s.section_offers, true)` (`:190`) justamente para reproducir lo que ven las tiendas que nunca lo guardaron.
- **¿Validación que rechace claves desconocidas?** **No.** No hay Zod, JSON Schema ni validación estructural en ningún lado del flujo (`RawCatalogSettings` es solo un tipo de TypeScript, borrado en runtime: `src/lib/types.ts:301-503`). El objeto crudo se castea (`src/context/StoreProvider.tsx:177`) y `normalizeStoreConfig` ignora en silencio toda clave que no lea. Agregar claves es seguro; el riesgo es el inverso — una clave mal tipeada nunca se queja, cae al default.
- **Tipos duplicados**: **a mano, en dos repos, sin nada que los sincronice.** `RawCatalogSettings` (`src/lib/types.ts:301`) y `StoreConfig` (`:566`) son locales de este repo; `package.json` no tiene ninguna dependencia compartida ni workspace con `procurva2` (solo supabase-js, clsx, lucide, react, react-router). Cada default está escrito dos veces, una por repo, y el único mecanismo de sincronización son los comentarios (ej. `src/lib/storeConfig.ts:29-30`: "Coinciden con los defaults de la migración 20260604").

### Trampa concreta para `section_max_items`: los dos caches versionados

Lo que se cachea en `sessionStorage` **no es el JSONB crudo sino la `StoreConfig` ya normalizada**:

```
src/context/StoreProvider.tsx:78-84   writeCache(slug, { config: normalized, ... })
src/context/StoreProvider.tsx:55      const cacheKey = (slug) => `procurva_store_config_v6:${slug}`;
src/context/StoreProvider.tsx:152-159 // primer paint desde cache
```

Un visitante recurrente pinta el primer frame con una `StoreConfig` vieja donde `sectionMaxItems` es `undefined` — no el default, `undefined` — hasta que llega la revalidación en segundo plano. Si el consumidor hace `slice(0, config.sectionMaxItems)` sin fallback propio, ese primer frame corta en 0. **Al agregar la clave hay que bumpear `v6` → `v7`** (el comentario de `:52-54` documenta que ya se hizo cinco veces por este mismo motivo), y aun así conviene un `?? 8` defensivo en el consumidor, que es exactamente el patrón que ya usa `useProductBadges` (`:80-81`).

Lo mismo aplica al cache de productos (`CACHE_VERSION = 'v1'`, `src/hooks/useProducts.ts:44`) si en algún momento cambia el SELECT.

---

## Bloque H — Datos disponibles en el cliente

Las columnas que llegan a las cards están en `src/hooks/useProducts.ts:24-32`:

```
COLS_BASE (24-31):
  id, company_id, name,
  retail_price, retail_price_transfer, retail_price_card, compare_at_price, wholesale_price,
  image_url, images, categories,
  catalog_visible, catalog_badge_text, catalog_badge_color, catalog_badge_visible,
  pack_only_sale, created_at,
  product_variants ( size, color, stock, image_url )

PRODUCT_COLUMNS (32) = COLS_BASE + is_featured, is_new_arrival, display_variants_separately,
                       curva_surtida_enabled, free_shipping
```

- **`created_at`: sí llega**, está en `COLS_BASE` (`:29`) — o sea, incluso en el modo degradado sin columnas opcionales. Declarado en el tipo en `src/lib/types.ts:151`.
- **`last_restock_at`: NO llega.** No figura en ninguna de las dos listas de columnas, no está en `Product` (`src/lib/types.ts:117-163`) y no aparece en ninguna línea de `src/`.

Para que llegara:

1. La query **vive en este repo**: es un `.from('products').select(...)` directo contra PostgREST (`src/hooks/useProducts.ts:101-108`), no una RPC del otro repo. Se agrega la columna a `COLS_BASE` o, más prudente, a `PRODUCT_COLUMNS` — que ya tiene el mecanismo de degradación: si la columna no existe, `OPTIONAL_COLS_RE` (`:34`) atrapa el error y reintenta con `COLS_BASE` (`:118-121`). Habría que sumar `last_restock_at` a ese regex también.
2. Declararla en `Product` (`src/lib/types.ts`), opcional (`?`), por el modo degradado.
3. Bumpear `CACHE_VERSION` de `'v1'` a `'v2'` (`src/hooks/useProducts.ts:44`) — si no, los visitantes recurrentes siguen leyendo del `sessionStorage` un payload sin la columna.
4. Verificar RLS: la policy anon sobre `products` tiene que exponer la columna. **NO CONFIRMADO** — no audité las policies (este repo solo tiene una migración, `supabase/migrations/20260604_storefront_config.sql`, que no toca `products`).

---

## 3. Hallazgos inesperados

1. **El límite de 12 se aplica antes de explotar las cards por color.** `buildSection` corta 12 *productos* (`src/pages/Home.tsx:92`) y recién después `ProductsSection` los expande en una card por color para los que tienen `display_variants_separately` (`src/components/home/ProductsSection.tsx:19` → `src/lib/utils.ts:145-165`). Una tienda con productos multicolor tiene vidrieras de 30+ cards hoy mismo. Si el objetivo del `section_max_items` es controlar el largo visible de la sección, el corte hay que hacerlo **sobre `cards`, no sobre `products`**, o el setting nuevo va a mentir igual que el actual.

2. **Dos definiciones incompatibles de "está en oferta".** La sección Ofertas usa exclusivamente `ecommerce_promotions` (`src/pages/Home.tsx:136`), mientras que el badge `-X%` de la card usa `compare_at_price` vs precio principal (`src/hooks/useProductBadges.tsx:77-78` → `src/lib/utils.ts:96-98`). Un producto con precio tachado y sin promo cargada muestra "-30%" en la card pero **no entra a Ofertas**; uno con promo y sin `compare_at_price` entra a Ofertas y muestra el badge de promo. Si el patrón de Ofertas es el modelo a replicar, vale saber que su membresía ya no es la misma que la señal de descuento que ve el comprador.

3. **El `discountPct` que ordena Ofertas se calcula sobre `retail_price`, no sobre el precio que muestra la card.** `refPrice` usa `p.retail_price` en minorista (`src/pages/Home.tsx:134`), pero la card muestra como principal `retail_price_card`, o `retail_price_transfer` si no hay tarjeta (`src/lib/utils.ts:87-89`). En tiendas con precio de tarjeta cargado, el orden "mayor descuento primero" no se corresponde con los porcentajes visibles.

4. **`section_offers` está en la normalización pero no en el tipo del panel-contract que me pasaste.** Se lee con default `true` (`src/lib/storeConfig.ts:190`) y está declarado en `RawCatalogSettings` (`src/lib/types.ts:370`). Si el panel todavía no lo escribe, la sección Ofertas no es apagable desde el admin. **NO CONFIRMADO** del lado del panel.

5. **El fallback documentado de `useFeaturedSections` no existe.** El comentario del hook dice: "si la tabla todavía no existe o anon no tiene permiso de lectura, cae en false y el Home usa el fallback por flags" (`src/hooks/useFeaturedSections.ts:14-15`), y el hook expone un `ok` para eso (`:22`, `:58`). Pero **`Home.tsx` nunca lee `fs.ok`** — no aparece en todo el archivo. Si la RPC falla, las secciones no caen a `is_featured`/`is_new_arrival`: simplemente quedan sin pins y muestran puro relleno automático. El `ok` es código muerto, y el fallback por flags solo existe en `/productos`. Vale corregirlo o borrar el comentario antes de construir encima.

6. **Ni el home ni el badge tienen en cuenta el reingreso de stock.** El trigger que bumpea `last_restock_at` con cualquier aumento de stock no tiene ningún consumidor de este lado. Un producto que se agota y vuelve no reaparece ni en "Nuevos ingresos" (salvo pin manual) ni con badge "Nuevo".

7. **Estados de carga inconsistentes entre las tres secciones** (detalle en Bloque A): solo Destacados tiene skeleton.

---

## 4. Lo que NO pude determinar

| Tema | Motivo |
|---|---|
| Definición SQL de `get_home_section_pins` y `get_top_selling_products` (orden exacto, GRANTs, si filtra por `catalog_visible`) | No están en este repo: `supabase/migrations/` tiene un solo archivo, `20260604_storefront_config.sql`, que no las define. Viven en `procurva2` o aplicadas a mano en prod. Lo que sí verifiqué es cómo las consume el cliente. |
| Si `get_home_section_pins` ya está aplicada en producción | No ejecuté SQL (restricción del audit). Si no lo estuviera, el síntoma sería un `console.warn` (`src/hooks/useFeaturedSections.ts:57`) y secciones con puro relleno automático. |
| Si el panel permite guardar `badges.new.window_days = 0` | No leí `procurva2` en esta auditoría. Importa porque acá un 0 se lee como 14 (`src/lib/storeConfig.ts:256`). |
| Si la policy RLS de `anon` sobre `products` expondría `last_restock_at` | No audité policies; no hay migraciones de `products` en este repo. |
| Si el panel escribe `section_offers` | Ver hallazgo 4. |
| Comportamiento real de `pin_position` vs el orden devuelto | El hook confía en el `ORDER BY` de la RPC y descarta `pin_position` (`src/hooks/useFeaturedSections.ts:65-69`). Correcto si la RPC ordena; no lo pude verificar sin su definición. |

---

## 5. Divergencias con el contrato del panel

| # | Contrato del panel | Qué hay en este repo | Impacto |
|---|---|---|---|
| 1 | Máximo **2** badges visibles | **1** — `deduped.slice(0, 1)`, `src/hooks/useProductBadges.tsx:144`, con comentario explicando que se bajó a propósito | Alto. Si el panel previsualiza dos badges, muestra algo que la tienda no pinta. |
| 2 | Prioridad: Últimas unidades > Envío gratis > Descuento > Nuevo | Hay un **quinto** badge entre medio: Últimas unidades > Envío gratis > Descuento/Promo > **etiqueta del catálogo (`custom`)** > Nuevo (`src/hooks/useProductBadges.tsx:97-125`) | Alto combinado con la #1: con tope 1, cualquier producto con etiqueta manual nunca muestra "Nuevo". |
| 3 | `get_top_selling_products` "para la regla automática de Destacados" | Coincide, pero se pide con `p_limit: 200` fijo (`src/hooks/useTopSelling.ts:32`) | Bajo. En catálogos de +200 productos, del 201 en adelante todos empatan en `MAX_SAFE_INTEGER` y caen al orden por recencia. |
| 4 | Los pins son la fuente de verdad de las tres secciones | Solo para `offers` los pins están subordinados a la membresía (`src/pages/Home.tsx:139`). En `featured` y `new_arrivals` el pin es absoluto **y además se rellena con el catálogo entero**, así que la "selección" del comercio es apenas el prefijo de una lista que siempre llega a 12 | Alto conceptual: el comercio cree que elige 5 productos y la vidriera muestra 12. |
| 5 | `products.is_featured` / `is_new_arrival`: "nadie las lee" | Falso del lado storefront: se leen en `/productos` (`src/pages/ProductList.tsx:113-114`, `:122-123`) | Medio. Conjunto invisible desde el panel que altera el orden del catálogo. Si se planea deprecar las columnas, hay que tocar `ProductList.tsx` primero. |
| 6 | `badges.new`: `window_days` 14, `enabled` false | **Coinciden** (`src/lib/storeConfig.ts:272`, `:275`) | Ninguno. Único par de defaults del audit que verifiqué idéntico en ambos lados. |
| 7 | `section_featured` / `section_new_arrivals` default `true` | **Coinciden** (`src/lib/storeConfig.ts:185-186`), y también con el seed de la migración local (`supabase/migrations/20260604_storefront_config.sql:52-53`, `:113-114`) | Ninguno. |
| 8 | `sections_order` | Coincide en la clave, pero este repo tiene lógica propia que el panel probablemente no modela: `withMissingSections` inserta por **anclaje de predecesores** las secciones que falten en un orden guardado (`src/pages/Home.tsx:67-80`), y hay un `DEFAULT_SECTION_ORDER` local (`:36-48`) que es una lista paralela más | Medio. Toda sección nueva agregada del lado panel tiene que existir también en `DEFAULT_SECTION_ORDER` y en el mapa `nodes` de este repo, o no se renderiza (`Home.tsx:33-34`, `:224-225`). |
| 9 | — | Sin mecanismo de sincronización de tipos: `RawCatalogSettings` y todos los defaults están duplicados a mano, sin paquete compartido (`src/lib/types.ts:301-503`, `package.json`) | Es la causa raíz estructural de todo lo de arriba. |
