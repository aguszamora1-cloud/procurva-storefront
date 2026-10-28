// ============================================================================
// COMPONENTE ESPEJADO — mantener BYTE-IDÉNTICO en los dos repos:
//   canónico:  procurva-storefront/src/lib/colorHelper.ts
//   espejo:    procurva2/utils/colorHelper.ts
// Son repos git independientes sin paquete compartido, así que la copia es
// manual. Si tocás uno, copiá el archivo entero al otro (no parchees a mano).
// El guard scripts/check-color-helper-mirror.mjs lo verifica en el prebuild.
// ============================================================================
//
// Nombres de color (mercado textil argentino) → hex, para pintar círculos/chips
// de color con el color que el comerciante realmente escribió.
//
// El campo `product_variants.color` es TEXTO LIBRE: no hay hex en la variante ni
// nombre normalizado. Cada empresa puede cargar SUS colores (nombre → hex, tabla
// `company_colors`, pantalla Ajustes → Colores); esos se registran con
// setCustomColors() y tienen prioridad sobre este mapa. Fuera de eso, el mapa es
// la única forma de saber de qué color estamos hablando, y por eso nunca va a
// cubrir el 100%: medido
// contra los datos reales del catálogo público (1.785 pares producto-color, 600
// nombres distintos) resuelve ~71% con el match por substring incluido. Lo que
// queda afuera es sobre todo inglés (black, white, blue), género/plural (negra,
// negras), códigos numéricos (514, 005) y descripciones que no son un color
// (animal print, camuflado).
//
// Hay DOS entradas a propósito:
//   - resolveColorHex() devuelve null cuando no sabe. Úsala cuando "no sé de qué
//     color es" tenga que verse distinto a "es gris" — p. ej. el selector de
//     color de la ficha, que muestra un chip de texto sin círculo en vez de
//     pintar un punto gris que miente sobre el color del producto.
//   - getColorHex() siempre devuelve un hex (gris de fallback). Es la API
//     histórica que usa el ERP, donde el círculo se pinta igual.

export const COLOR_MAP: Record<string, string> = {
  // Básicos
  'negro': '#000000',
  'blanco': '#FFFFFF',
  'gris': '#808080',
  'gris claro': '#D3D3D3',
  'gris oscuro': '#404040',
  'gris melange': '#B0B0B0',
  'melange': '#B0B0B0',

  // Azules
  'azul': '#0000FF',
  'azul marino': '#001F5B',
  'marino': '#001F5B',
  'azul francia': '#0055A4',
  'francia': '#0055A4',
  'azul rey': '#4169E1',
  'celeste': '#87CEEB',
  'celeste claro': '#B0E0E6',
  'azul piedra': '#5B7C99',
  'azul petróleo': '#005F6B',
  'azul petroleo': '#005F6B',
  'azul acero': '#4682B4',
  'jean': '#4A6FA5',
  'denim': '#1560BD',
  'indigo': '#4B0082',
  'turquesa': '#40E0D0',
  'acqua': '#00FFFF',
  'agua': '#00FFFF',
  'aero': '#7DD3FC',

  // Rojos / Rosas
  'rojo': '#FF0000',
  'bordo': '#800020',
  'bordó': '#800020',
  'borgoña': '#800020',
  'borgona': '#800020',
  'vino': '#722F37',
  'coral': '#FF7F50',
  'salmón': '#FA8072',
  'salmon': '#FA8072',
  'rosa': '#FFC0CB',
  'rosa viejo': '#C08081',
  'rosa palo': '#E8B4B8',
  'fucsia': '#FF00FF',
  'magenta': '#FF0090',
  'cereza': '#DE3163',
  'ladrillo': '#CB4154',
  'terracota': '#E2725B',
  'teja': '#C14A09',

  // Verdes
  'verde': '#008000',
  'verde militar': '#4B5320',
  'verde oliva': '#808000',
  'verde musgo': '#4A5D23',
  'verde botella': '#006A4E',
  'verde agua': '#66CDAA',
  'verde menta': '#98FF98',
  'verde salvia': '#9CAF88',
  'verde esmeralda': '#50C878',
  'verde oscuro': '#006400',
  'verde seco': '#65A30D',
  'lima': '#00FF00',
  'jade': '#00A86B',
  'eucalipto': '#5F8575',

  // Marrones / Tierras
  'marrón': '#8B4513',
  'marron': '#8B4513',
  'chocolate': '#7B3F00',
  'café': '#6F4E37',
  'cafe': '#6F4E37',
  'camel': '#C19A6B',
  'arena': '#C2B280',
  'beige': '#F5F5DC',
  'crudo': '#FFFDD0',
  'crema': '#FFFDD0',
  'hueso': '#F0EAD6',
  'natural': '#F5F0E0',
  'nude': '#E3BC9A',
  'caramelo': '#FFD59A',
  'mostaza': '#FFDB58',
  'ocre': '#CC7722',
  'tabaco': '#71532E',
  'cognac': '#9A463D',
  'tostado': '#CD853F',
  'tierra': '#9B7653',
  'suela': '#C5AE91',
  'marfil': '#FFFFF0',

  // Amarillos / Naranjas
  'amarillo': '#FFD700',
  'dorado': '#DAA520',
  'naranja': '#FFA500',
  'durazno': '#FFDAB9',

  // Violetas
  'violeta': '#8B00FF',
  'lila': '#C8A2C8',
  'lavanda': '#E6E6FA',
  'morado': '#800080',
  'púrpura': '#800080',
  'purpura': '#800080',
  'uva': '#6F2DA8',
  'ciruela': '#8E4585',

  // Italiano (marcas que nombran los colores como el proveedor). Los que se
  // escriben igual que en castellano (rosa, verde, fucsia, lavanda) ya están
  // arriba. Los tonos puntuales los carga cada empresa en Ajustes → Colores.
  'nero': '#000000',
  'bianco': '#FFFFFF',
  'bianco ottico': '#FFFFFF',
  'panna': '#FFFDD0',
  'avorio': '#FFFFF0',
  'ecru': '#F0EAD6',
  'grigio': '#808080',
  'grigio chiaro': '#D3D3D3',
  'grigio scuro': '#404040',
  'grigio melange': '#B0B0B0',
  'antracite': '#3B3B3B',
  'blu': '#0000FF',
  'blu navy': '#001F5B',
  'blu notte': '#191970',
  'blu scuro': '#00008B',
  'blu royal': '#4169E1',
  'azzurro': '#87CEEB',
  'turchese': '#40E0D0',
  'petrolio': '#005F6B',
  'rosso': '#FF0000',
  'bordeaux': '#800020',
  'corallo': '#FF7F50',
  'cipria': '#E8C4B8',
  'rosa antico': '#C08081',
  'verde militare': '#4B5320',
  'verde bottiglia': '#006A4E',
  'oliva': '#808000',
  'salvia': '#9CAF88',
  'menta': '#98FF98',
  'smeraldo': '#50C878',
  'marrone': '#8B4513',
  'testa di moro': '#3D2B1F',
  'cioccolato': '#7B3F00',
  'cammello': '#C19A6B',
  'cuoio': '#9A463D',
  'tortora': '#B9A99A',
  'sabbia': '#C2B280',
  'giallo': '#FFD700',
  'senape': '#FFDB58',
  'arancio': '#FFA500',
  'arancione': '#FFA500',
  'ruggine': '#B7410E',
  'mattone': '#CB4154',
  'viola': '#8B00FF',
  'lilla': '#C8A2C8',
  'glicine': '#C9A0DC',
  'prugna': '#8E4585',
  'melanzana': '#614051',
  'oro': '#DAA520',
  'argento': '#C0C0C0',

  // Catch-all / single-size sentinel
  'único': '#9CA3AF',
  'unico': '#9CA3AF',
};

const FALLBACK_HEX = '#CCCCCC';

/**
 * Valores que el comercio usa como "este producto no tiene color": los pone el
 * importador o el alta manual cuando la variante es única. NO son colores, así
 * que resolveColorHex() los descarta aunque 'único' esté en COLOR_MAP (está por
 * compatibilidad con el ERP, que ahí sí pinta su gris).
 *
 * Medido en el catálogo público: 'fijo' (733 variantes), 'único' (469) y '-'
 * (380) son, por lejos, los tres valores más frecuentes de la columna color.
 */
const SENTINELS = new Set(['fijo', 'único', 'unico', '-', '--', 's/c', 'sin color', 'n/a']);

function normalize(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ');
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

// Colores propios de la empresa activa (nombre normalizado → hex). Los carga una
// sola vez la app (ERP: al conocer la empresa; tienda: al resolver la tienda) y
// tienen prioridad sobre COLOR_MAP. Vacío = comportamiento de siempre.
let customColors: Record<string, string> = {};
let customColorsVersion = 0;
const customColorsListeners = new Set<() => void>();

/**
 * Registra los colores propios de la empresa. Filas con nombre vacío, hex
 * inválido o nombre centinela ('único', '-', …) se descartan. Avisa a los
 * suscriptos para que los círculos ya pintados se vuelvan a pintar.
 */
export function setCustomColors(list: ReadonlyArray<{ name: string | null; hex: string | null }> | null | undefined): void {
  const next: Record<string, string> = {};
  for (const row of list ?? []) {
    const name = normalize(row?.name ?? '');
    const hex = (row?.hex ?? '').trim();
    if (!name || SENTINELS.has(name) || !HEX_RE.test(hex)) continue;
    next[name] = hex.toUpperCase();
  }
  customColors = next;
  customColorsVersion += 1;
  customColorsListeners.forEach((fn) => fn());
}

/** Para useSyncExternalStore: se dispara cada vez que cambian los colores propios. */
export function subscribeCustomColors(fn: () => void): () => void {
  customColorsListeners.add(fn);
  return () => {
    customColorsListeners.delete(fn);
  };
}

export function getCustomColorsVersion(): number {
  return customColorsVersion;
}

// Match parcial: la clave más larga que aparece dentro del nombre (o al revés),
// así "azul marino" le gana a "azul".
function bestPartial(name: string, map: Record<string, string>): string | null {
  let best: string | undefined;
  for (const key of Object.keys(map)) {
    if (name.includes(key) || key.includes(name)) {
      if (!best || key.length > best.length) best = key;
    }
  }
  return best ? map[best] : null;
}

/**
 * Hex del color, o null si el nombre no se puede resolver a un color conocido.
 * Null significa "no sé de qué color es", que es información distinta de "es
 * gris" y hay que poder mostrarla distinto.
 *
 * Orden: propio exacto → mapa exacto → propio parcial → mapa parcial. El propio
 * le gana siempre al mapa: si la empresa dice que su "Rosso" es bordó, es bordó.
 */
export function resolveColorHex(colorName: string | null | undefined): string | null {
  if (!colorName) return null;
  const name = normalize(colorName);
  if (!name || SENTINELS.has(name)) return null;

  // 1. Exact match
  const exact = customColors[name] ?? COLOR_MAP[name];
  if (exact) return exact;

  // 2. Partial match
  return bestPartial(name, customColors) ?? bestPartial(name, COLOR_MAP);
}

/**
 * Hex del color, con gris de fallback cuando no se puede resolver. API histórica
 * del ERP (esferas/chips de color de POS, Productos, OrderDetail, etc.).
 *
 * El lookup exacto va PRIMERO para no cambiar lo que el ERP viene mostrando:
 * los centinelas ('único') están en COLOR_MAP y siguen devolviendo su gris,
 * aunque resolveColorHex() los descarte.
 */
export function getColorHex(colorName: string | null | undefined): string {
  if (!colorName) return FALLBACK_HEX;
  const name = normalize(colorName);
  if (!name) return FALLBACK_HEX;
  return customColors[name] ?? COLOR_MAP[name] ?? resolveColorHex(colorName) ?? FALLBACK_HEX;
}
