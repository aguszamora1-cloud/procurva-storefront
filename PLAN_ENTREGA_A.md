# Plan — Entrega A: límite por sección (contando cards) + "ver más"

Plan de cambios archivo por archivo. **Nada implementado todavía.**

Repos: `procurva-storefront` (tienda) y `procurva2` (panel, vía `--add-dir`).

**Estado:** decisiones cerradas (ver §0). Falta tu ok para escribir código.

---

## 0. Decisiones

### 0.1 `AUDIT_DESTACADOS.md` — cerrado

El audit existe pero quedó fuera del repo. No lo busco más. El contrato del prompt sale de ahí, y **coincide con lo que leí en el código del panel**, punto por punto:

| Contrato del prompt | Verificado en |
|---|---|
| `section ∈ ('featured','new_arrivals','offers')` | `catalogShared.tsx:146-152` (`SECTIONS`) |
| `section_featured` / `section_new_arrivals` booleanos, default `true` | `types.ts:1604-1605`, `catalogShared.tsx:146-147` (`defaultOn: true`) |
| `settings` = `companies.storefront_config -> {retail\|wholesale} -> settings` | `OnlineCatalog.tsx:305-312` (lectura), `:479-499` (escritura) |
| `sections_order`, `section_titles` | `types.ts:1621-1624` |
| `badges.new = { enabled, color, label, window_days }` | `types.ts:1586-1596` |
| Ofertas: membresía derivada, el panel no elige productos | `EditOffers.tsx:5-17` (comentario explícito) |

Nada de lo que asumo abajo depende de algo que no haya visto en el código.

### 0.2 Dónde va el input — **decidido: instancia única, panel global de Diseño**

Un mismo valor repetido en tres paneles hace creer que es por sección. Va **una sola vez**, con etiqueta que diga explícitamente que aplica a las tres.

Ubicación concreta: **card nueva en `CatalogDesignTab.tsx`, justo después de la card "Categorías"** (`:471-497`), que es el vecino correcto — mismo tipo de ajuste (cómo se muestra una sección del home), misma tab, sin gate de plan.

**No va en la card "Diseño avanzado"** (`:503`), aunque tenga la alineación de títulos de secciones y parezca el lugar natural: esa card está gateada a PRO con overlay (`:504-522`) y todos sus controles llevan `disabled={!isPlanPro}`. Meter ahí el límite lo volvería una función Profesional, que no es lo que se pidió.

### 0.3 El link "Ver todo" del encabezado — **decidido: B1**

Hoy las tres secciones pasan `linkTo="/productos"` y `SectionHeader` pinta un "Ver todo" arriba a la derecha (`src/components/SectionHeader.tsx:32-39`; `src/pages/Home.tsx:161`, `:165`, `:172`). Con el botón nuevo abajo, la sección queda con dos links.

**B1 — los dos apuntan a `/productos?seccion=<x>`.** "Ver todo" (arriba) y "Ver más productos" (abajo) llevan al mismo lado: el resto de *esa* sección. Cambia el destino actual del "Ver todo", que hoy va al catálogo completo.

**B2 — "Ver todo" queda como está** (`/productos`, catálogo completo) y solo el botón nuevo lleva al subconjunto. No toca nada existente, pero deja dos links a centímetros de distancia, con etiquetas casi iguales, que llevan a páginas distintas.

**Recomiendo B1, y es lo que elegiste.** Motivo: en B2 el visitante no tiene forma de saber que "Ver todo" y "Ver más productos" difieren — la diferencia no está en el texto, y adivinar mal cuesta una navegación. Además la promesa de una sección con corte es "hay más de esto", no "hay más cosas en otro lado". El costo de B1 (perder el atajo al catálogo completo desde el home) queda cubierto: el listado con `?seccion=` trae su propio botón "Ver todo el catálogo" que limpia el parámetro (§2.8).

### 0.4 Default **12**, no 8 — cambio respecto del prompt

Con 66 storefronts en producción no entran dos cambios visibles en el mismo deploy. Con default 12 el único efecto del deploy es que **el límite pasa a significar lo que dice**: hoy "12" son 12 productos que pueden ser 36 cards; después son 12 cards. Ninguna tienda ve un número distinto del que ya tenía configurado de hecho.

El rango del input **se mantiene en 4-24**. El comercio que quiera 8 lo baja a mano.

### 0.5 Agotadas al fondo del conjunto completo — confirmado

`toCatalogCards` manda las cards agotadas al fondo *sobre el conjunto entero* (`src/lib/utils.ts:164`). Hoy eso opera sobre 12 productos; con el corte movido, opera sobre la lista completa antes de cortar. Es un cambio observable — un producto agotado que hoy entra en la vidriera puede dejar de entrar — y **está aceptado**.

### 0.6 Título del listado con `?seccion=` — entra

Con `?seccion=` el encabezado de `/productos` pasa a "Destacados" / "Nuevos ingresos" / "Ofertas", con botón para limpiar el filtro, mismo patrón que el bloque de `?q=` (`src/pages/ProductList.tsx:203-221`). Sin esto el "ver más" cae en una página que dice "Todos los productos" mostrando doce, y se lee como bug.

---

## 1. El corte cuenta cards, no productos (el trabajo central)

### El problema, con precisión

```
src/pages/Home.tsx:87-93                     buildSection() → slice(0, 12) sobre PRODUCTOS
src/components/home/ProductsSection.tsx:19   toCatalogCards(products) → expande a CARDS por color
```

El orden está invertido: se corta y después se expande. Doce productos de tres colores son treinta y seis cards.

### La solución

Invertir el orden: `buildSection` deja de cortar (devuelve la lista completa ordenada) y el corte pasa a `ProductsSection`, **después** de `toCatalogCards`.

Esto además es lo que habilita el "ver más" sin reimplementar nada: la lista completa ya está calculada, así que `hasMore` es una comparación de longitudes y `/productos?seccion=` puede reusar exactamente el mismo array.

**Nota de performance:** expandir el catálogo completo tres veces por render del home (una por sección) es más caro que expandir 12 productos. Es aceptable y no lo optimizo: `/productos` ya hace exactamente eso mismo hoy sobre el catálogo entero (`src/components/ProductGrid.tsx:48`), y todo va memoizado. Si con un catálogo grande se notara, la salida sería un corte incremental — pero eso rompe el "agotadas al fondo" de §0.5, así que no es gratis.

---

## 2. `procurva-storefront` — archivo por archivo

### 2.1 `src/lib/types.ts` (2 cambios)

- En `RawCatalogSettings`, junto a `sections_order` (`:384`):

  ```ts
  /** Máximo de cards visibles por sección de productos del home. Default 12, rango 4-24. */
  section_max_items?: number;
  ```

- En `StoreConfig`, junto a `sectionsOrder` (`:649`): `sectionMaxItems: number;` (no opcional — la normalización siempre lo resuelve).

### 2.2 `src/lib/storeConfig.ts` — el default vive acá

Dentro de `normalizeStoreConfig`, junto a `sectionsOrder` (`:202-204`):

```ts
// Máximo de cards por sección de productos del home. El corte se hace sobre las
// cards ya expandidas por color, no sobre productos. Default 12 = el SECTION_LIMIT
// histórico, para que el deploy cambie SOLO el significado del límite y no el
// número que ve cada tienda. Se resuelve ACÁ y no en el punto de lectura porque
// el sessionStorage cachea esta StoreConfig ya normalizada.
sectionMaxItems: (() => {
  const v = s.section_max_items;
  if (typeof v !== 'number' || !Number.isFinite(v)) return 12;
  return Math.min(24, Math.max(4, Math.round(v)));
})(),
```

El clamp a 4-24 va **también acá**, no solo en el input: el JSONB puede traer cualquier cosa (edición manual, valor viejo, bug del panel) y la tienda no puede quedar mostrando 0 cards. Mismo criterio que el `num(v, d)` de los badges (`:256`).

### 2.3 `src/context/StoreProvider.tsx:55` — bump de cache

`procurva_store_config_v6` → `procurva_store_config_v7`, y una línea al comentario de `:52-54` diciendo que v7 suma `sectionMaxItems`. Sin esto el primer frame de todo visitante recurrente lee `undefined`.

(El `??` defensivo en el consumidor lo pongo igual — cinturón y tiradores, mismo patrón que `useProductBadges.tsx:80-81`.)

### 2.4 `src/lib/homeSections.ts` — **archivo nuevo**

Funciones puras, sin React, para que las compartan home y listado:

```ts
/** Pins arriba (los que existen en el catálogo) + resto por la regla automática, sin duplicar. SIN LÍMITE. */
export function buildSectionProducts(products: Product[], pinIds: string[], autoOrdered: Product[]): Product[]

/** Cards de una sección ya expandidas por color, cortadas al máximo. Informa si sobró algo. */
export function limitSectionCards(products: Product[], max: number): { cards: Product[]; total: number; hasMore: boolean }
```

`buildSectionProducts` es **literalmente** el `buildSection` actual (`src/pages/Home.tsx:87-93`) menos el `.slice()`. Sin cambios de comportamiento.
`limitSectionCards` es `toCatalogCards(products)` + `slice(0, max)` + `total > max`.

### 2.5 `src/hooks/useHomeSections.ts` — **archivo nuevo**

El punto clave del requisito "el listado y la sección no pueden divergir": **una sola función arma las tres listas, y la consumen las dos páginas.**

```ts
export type HomeSectionKey = 'featured' | 'new_arrivals' | 'offers';

export function useHomeSections(products: Product[], opts?: { enabled?: boolean }): {
  featured: Product[];      // listas COMPLETAS, sin límite
  newArrivals: Product[];
  offers: Product[];
  pins: { featured: string[]; newArrivals: string[]; offersOrder: string[] };
  loading: boolean;
}
```

Adentro, movido tal cual desde `Home.tsx:114-141`:
- `useFeaturedSections()` — los pins (**el hook no se modifica**, solo se lo llama desde acá);
- `useTopSelling()` — el ranking para el orden de Destacados;
- `usePromotions()` + `useStore()` — la membresía y el orden de Ofertas (**la lógica no cambia**, se mueve de archivo);
- los tres `useMemo` con `buildSectionProducts`.

`products` entra **por parámetro** a propósito: si el hook llamara a `useProducts()` internamente, la página dispararía dos veces la query del catálogo (`useProducts` tiene estado propio por llamada).

`opts.enabled` (default `true`) evita que `/productos` pague el RPC `get_top_selling_products` cuando no hay `?seccion=`. Requiere sumarle un parámetro `enabled` opcional a `useTopSelling` — hook que **no** está en la lista de intocables; el cambio es aditivo y el default preserva el comportamiento actual.

`pins` se expone para que `ProductList` deje de llamar a `useFeaturedSections()` por su cuenta y no se dispare el RPC de pins dos veces en la misma página.

### 2.6 `src/pages/Home.tsx`

- Borrar `SECTION_LIMIT` (`:82`) y `buildSection` (`:87-93`) — se van a `lib/homeSections.ts`.
- Borrar los tres `useMemo` (`:114-141`) y los imports de `useTopSelling` / `usePromotions` — se van a `useHomeSections`.
- Reemplazar por `const { featured, newArrivals, offers } = useHomeSections(products);`
- Los tres `<ProductsSection>` (`:161`, `:165`, `:172`) reciben `maxItems={config.sectionMaxItems}` y `linkTo="/productos?seccion=<destacados|nuevos|ofertas>"` (decisión 0.3-B1).
- El guard `offers.length > 0` de `:171` se mantiene igual (ahora mide la lista completa, que a efectos del guard es lo mismo).

Sin tocar: `DEFAULT_SECTION_ORDER`, `withMissingSections`, el mapa `nodes`, los gates de plan, el orden de render.

### 2.7 `src/components/home/ProductsSection.tsx` — el corte y el botón

```tsx
interface Props { …; maxItems: number; }

const { cards, hasMore } = useMemo(() => limitSectionCards(products, maxItems), [products, maxItems]);
if (cards.length === 0) return null;          // igual que hoy (:20)
```

Y debajo de la grilla, solo si `hasMore` y hay `linkTo`:

```tsx
<div className="mt-8 flex justify-center md:mt-10">
  <Link to={linkTo} className="…">Ver más productos</Link>
</div>
```

Estilo: botón secundario con borde, tipografía uppercase/tracking del resto de la tienda (mismo lenguaje que el botón "Ver N productos" del drawer de filtros, `src/pages/ProductList.tsx:319-325`). Sin emojis.

### 2.8 `src/pages/ProductList.tsx` — `?seccion=`

- Leer `const seccion = searchParams.get('seccion')` y mapear `destacados|nuevos|ofertas` → la lista correspondiente de `useHomeSections(products, { enabled: Boolean(seccion) })`.
- Reemplazar la llamada directa a `useFeaturedSections()` (`:33`) por los `pins` que devuelve el hook nuevo. **El sort de `:99-128` no se toca** — sigue usando `featured`/`newArrivals` como ids y el desempate por `is_featured`/`is_new_arrival` queda igual (fuera de alcance).
- El conjunto base del listado pasa a ser la lista de la sección cuando `?seccion=` está presente; los filtros existentes (categoría, `q`, talle, color, precio) se aplican encima, sin cambios.
- **Orden:** con `?seccion=` y sin `?orden=` explícito se respeta el orden de la sección (no se re-ordena). Si el visitante elige un orden en el select, ese gana. Implementación: `orden` pasa a ser `searchParams.get('orden') ?? (seccion ? 'seccion' : 'destacados')`, con un `case 'seccion': return arr;` y una opción extra en el select ("Orden de la sección") visible solo cuando `?seccion=` está activo.
- **Encabezado (§0.6):** título "Destacados" / "Nuevos ingresos" / "Ofertas" + botón "Ver todo el catálogo" que limpia el parámetro, espejo del bloque de `?q=` (`:203-221`).

---

## 3. `procurva2` (panel) — archivo por archivo

### 3.1 `types.ts`

En `CatalogSettings`, junto a `sections_order` (`:1621-1624`):

```ts
// Máximo de productos visibles por sección de productos del home (Destacados,
// Nuevos ingresos, Ofertas). El storefront lo cuenta sobre las CARDS ya
// expandidas por color. Default 12 (= el límite histórico), rango 4-24.
section_max_items?: number;
```

### 3.2 `components/catalog/CatalogDesignTab.tsx` — card nueva, instancia única

Card nueva después de la de "Categorías" (`:471-497`), sin gate de plan:

- `CardHeader`: título **"Secciones de productos"**, subtítulo **"Cuántos productos se muestran en Destacados, Nuevos ingresos y Ofertas."** — el "las tres" es explícito en el subtítulo *y* en la ayuda del campo, para que no se lea como un ajuste de una sección.
- `FieldLabel`: "Productos por sección".
- `NumberInput` (`components/ui/NumberInput.tsx`, no un `<input type="number">` suelto — arrastra el bug del "0 pegado", ya resuelto ahí):
  - `value={settings.section_max_items ?? null}`, `placeholder="12"`;
  - `onChange`: `null` (campo vacío) → escribe `undefined`, la clave se cae del JSONB y vuelve al default 12. Número → clamp 4-24 en `onBlur`, no mientras se tipea (para no pelearse con el tecleo).
- Ayuda debajo: *"Se aplica a las tres secciones de productos del inicio. El resto de los productos aparece con el botón 'Ver más productos'. Mínimo 4, máximo 24."*

### 3.3 Nada más

Sin migración: `section_max_items` viaja dentro del `settings` que ya se guarda entero en `companies.storefront_config[canal].settings` (`OnlineCatalog.tsx:479-499`). El objeto se persiste con spread, así que una clave nueva pasa sola.

**No** lo agrego a `DEFAULT_CATALOG_SETTINGS` (`:70-91`): así el JSONB sigue guardando solo lo que el comercio tocó, que es la convención del repo. Por canal sale gratis — `settings` ya es por canal, retail y wholesale tienen su propio blob.

---

## 4. Compatibilidad con tenants existentes

| Caso | Qué pasa |
|---|---|
| Tenant sin la clave (la enorme mayoría) | `normalizeStoreConfig` → 12. **Mismo número que hoy**, pero ahora son 12 cards de verdad. |
| Tenant con productos multicolor en una sección | Es el único que ve un cambio: la sección deja de desbordarse a 20-36 cards y corta en 12. Era el bug. |
| Tenant con cache `v6` en sessionStorage | El bump a `v7` invalida la entrada; el primer frame se pinta desde la RPC. |
| Valor basura en el JSONB (0, -3, `"12"`, 999) | Clamp a 4-24 en la normalización. Nunca cero cards. |
| Sección con menos cards que el límite | Sin botón (`hasMore === false`). |
| RPC de pins caída | Igual que hoy: sin pins, relleno automático. No cambia. |

Con el default en 12 (§0.4), **el deploy no cambia el número de productos de ninguna tienda que no tenga productos multicolor**. El único cambio universal es de navegación: el "Ver todo" del encabezado ahora lleva al subconjunto de la sección (§0.3).

---

## 5. Qué NO toco (confirmado contra la lista de fuera de alcance)

- `src/hooks/useFeaturedSections.ts` — se lo llama desde otro lado, no se modifica.
- La membresía de `offers` — el bloque se mueve de archivo, línea por línea, sin cambios.
- `src/hooks/useProductBadges.tsx` — nada, en especial el `slice(0, 1)` de `:144`.
- `is_featured` / `is_new_arrival` y el desempate de `ProductList.tsx:113-123`.
- La regla automática de `new_arrivals` (Entrega B).
- El `ok` muerto de `useFeaturedSections` — queda anotado abajo.
- Migraciones: ninguna.

---

## 6. Deuda anotada y propuestas que NO implemento

1. **Tope de variantes por producto.** Un producto de 8 colores puede comerse la vidriera entera. Aceptado para esta entrega. Propuesta para más adelante: un segundo límite "máximo N cards por producto" en la expansión (`toCatalogCards`, `src/lib/utils.ts:145-165`), que es donde vive el problema, no en el corte.
2. **`useFeaturedSections.ok` es código muerto** — el comentario de `:14-15` promete un fallback por flags que `Home.tsx` nunca implementó.
3. **Ofertas ordena por un `%` que no es el que se ve.** `discPct` usa `retail_price`, pero la card muestra `retail_price_card` (hallazgo 3 del audit). Se mueve tal cual, sin arreglar.
4. **`?seccion=ofertas` depende de las promos cargadas en memoria.** Si `PromotionsProvider` sigue cargando, la lista sale vacía por un instante — igual que hoy en el home. El gate de primer paint lo tapa; lo verifico al implementar.
5. **El subtítulo de la card "Badges" del panel dice "Se muestran hasta 2 por producto"** (`CatalogDesignTab.tsx:359`), pero la tienda muestra **1** (`useProductBadges.tsx:144`). Es la divergencia #1 del audit. No lo toco: los badges son otra entrega.
6. **`section_max_items` no aplica a las secciones que no son de productos** (categorías, outfits, videos). Cada una tiene su corte hardcodeado (`CategoriesSection.tsx:123` → 8; `OutfitsSection.tsx:58` y `:109` → 4 y 5). Fuera de alcance.

---

## 7. Verificación antes de darlo por hecho

- `procurva-storefront`: `npm run lint` (es `tsc --noEmit`) y `npm run build` en verde.
- `procurva2`: no tiene script de typecheck; corro `npx tsc --noEmit`. Ese repo arrastra errores previos (hay `ts_errors*.txt` versionados), así que tomo baseline antes de tocar nada y confirmo que no sumo ninguno nuevo.
- Sin commits, sin deploy.

---

## 8. Lo que vas a tener que probar a mano (detalle al entregar)

Home con un producto multicolor en la sección (que el corte cuente cards), tienda con menos productos que el límite (que no aparezca el botón), el botón cayendo en un listado con el mismo conjunto y el mismo orden, un tenant que nunca tocó la clave (que vea 12), el valor guardado en el panel reflejándose en la tienda después de un reload, y retail/wholesale con valores independientes.

---

**Plan actualizado con las seis decisiones de §0. Esperando tu ok para escribir código.**
