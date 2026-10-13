import type { ButtonCornerStyle, CornerStyle, StoreConfig } from './types';
import { typographyFor } from './typographyRuntime';
import { STATUS_BASE, accentInk, greyAlphas, minAlphaForContrast, parseHex, readableFill } from './contrast';

/**
 * Escalas de esquinas por preset. Las claves son las mismas que la escala de
 * Tailwind (`rounded-lg` → --radius-lg), así que cambiar de preset reacomoda
 * toda la tienda sin tocar un solo componente.
 *
 * `rounded` reproduce EXACTAMENTE la escala default de Tailwind: es el aspecto
 * que la tienda tenía antes de existir el token, y el default de la config.
 */
const CORNER_SCALES: Record<CornerStyle, Record<string, string>> = {
  square: {
    sm: '0px',
    md: '0px',
    lg: '0px',
    xl: '0px',
    '2xl': '0px',
    '3xl': '0px',
    // La pastilla también se endereza: si no, los chips de talle quedarían
    // flotando redondos entre cards rectas, que es justo lo que se quiere evitar.
    pill: '0px',
  },
  rounded: {
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    pill: '9999px',
  },
  soft: {
    sm: '0.25rem',
    md: '0.625rem',
    lg: '0.875rem',
    xl: '1.25rem',
    '2xl': '1.625rem',
    '3xl': '2.125rem',
    pill: '9999px',
  },
};

/** Radio de los botones. 10px = el `rounded-[10px]` histórico de los CTA. */
const BUTTON_RADII: Record<ButtonCornerStyle, string> = {
  square: '0px',
  rounded: '10px',
  pill: '9999px',
};

/** #RGB | #RRGGBB → {r,g,b}. Fallback negro. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Luminancia relativa simple para decidir texto blanco/negro encima. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Color de texto legible (blanco o casi-negro) sobre un fondo dado. */
export function contrastColor(bg: string): string {
  return luminance(bg) > 0.6 ? '#111111' : '#ffffff';
}

/**
 * Color de texto SEGURO sobre un fondo: respeta el color configurado si
 * contrasta lo suficiente con el fondo; si no (ej. texto blanco con fondo
 * blanco), cae a un color legible derivado del fondo. Se usa en componentes con
 * fondo propio (product cards, navbar) para que el texto nunca desaparezca,
 * sin pisar elecciones de color legítimas (gris oscuro sobre blanco, etc.).
 */
export function safeText(text: string, bg: string): string {
  return Math.abs(luminance(text) - luminance(bg)) >= 0.25 ? text : contrastColor(bg);
}

/**
 * Color de RELLENO seguro sobre una superficie: usa el color pedido si se
 * distingue del fondo y, si no, cae al inverso del fondo. Sirve para botones
 * sólidos sobre secciones de color: una tienda con acento negro dibujaba un
 * botón negro sobre una sección negra y sólo se leía el texto, sin forma de
 * botón. Es el equivalente de `safeText` para fondos.
 */
export function safeFill(fill: string, surface: string): string {
  return Math.abs(luminance(fill) - luminance(surface)) >= 0.25 ? fill : contrastColor(surface);
}

/** rgba() a partir de hex + alpha. */
export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Variables de superficie para un bloque con fondo PROPIO (hoy: el encabezado).
 * Se ponen como `style` en el contenedor y pisan, sólo ahí adentro, los mismos
 * tokens que ya usan los componentes (`bg-background`, `text-on-surface`,
 * `border-line`): así el bloque cambia de color sin reescribir ninguna clase.
 * El texto sale del contraste con el fondo, no se elige — un encabezado negro
 * con texto negro no es una opción que valga la pena ofrecer.
 */
export function surfaceVars(bg: string): Record<string, string> {
  const fg = contrastColor(bg);
  return {
    '--color-background': bg,
    '--color-on-surface': fg,
    '--color-on-surface-muted': rgba(fg, 0.62),
    '--color-on-surface-subtle': rgba(fg, 0.42),
    '--color-border': rgba(fg, 0.16),
  };
}

/**
 * Inyecta las CSS variables del tenant en :root. Todos los componentes leen
 * de estas variables (nunca colores hardcodeados).
 */
export function applyTheme(config: StoreConfig): void {
  const root = document.documentElement;
  const set = (k: string, v: string) => root.style.setProperty(k, v);

  set('--color-primary', config.colorPrimary);
  set('--color-secondary', config.colorSecondary);
  set('--color-accent', config.colorAccent);
  set('--color-background', config.colorBackground);
  set('--color-text', config.colorText);

  // Derivados.
  set('--color-on-accent', contrastColor(config.colorAccent));
  set('--color-on-primary', contrastColor(config.colorPrimary));
  set('--color-muted', rgba(config.colorText, 0.62)); // texto secundario (ink-800)
  set('--color-subtle', rgba(config.colorText, 0.42)); // texto terciario (ink-500/700)
  set('--color-border', rgba(config.colorText, 0.12)); // bordes (ink-200)
  set('--color-border-soft', rgba(config.colorText, 0.07)); // bordes suaves (ink-100)

  // Texto seguro para componentes con fondo propio (cards, navbar): contrasta
  // siempre con --color-background, así los nombres de producto / links no
  // desaparecen si el texto configurado no contrasta con el fondo.
  const onSurface = safeText(config.colorText, config.colorBackground);
  set('--color-on-surface', onSurface);
  set('--color-on-surface-muted', rgba(onSurface, 0.62));
  set('--color-on-surface-subtle', rgba(onSurface, 0.42));

  // Grises con contraste AA (lib/contrast). Se calculan siempre pero SÓLO los
  // lee el bloque `[data-ink='v2']` de globals.css, que existe únicamente en
  // v2 y dentro de las páginas del alcance (ContrastScope): en v1 son variables
  // que nadie usa. Mismo formato rgba que los de arriba, así que sobre otro
  // fondo se comportan igual que hoy, sólo que más firmes.
  const greys = greyAlphas(config.colorText, config.colorBackground, config.colorSecondary);
  set('--color-muted-aa', rgba(config.colorText, greys.muted));
  set('--color-subtle-aa', rgba(config.colorText, greys.subtle));
  const surfaceGreys = greyAlphas(onSurface, config.colorBackground, config.colorSecondary);
  set('--color-on-surface-muted-aa', rgba(onSurface, surfaceGreys.muted));
  set('--color-on-surface-subtle-aa', rgba(onSurface, surfaceGreys.subtle));
  // Tinta del acento (C4): el acento como color de TEXTO, con AA. Mismo
  // criterio: sólo la lee el bloque v2 de globals.css; los fondos de botones y
  // badges siguen con --color-accent tal cual lo eligió el comercio.
  set('--color-accent-ink', accentInk(config.colorAccent, config.colorBackground, config.colorSecondary));
  // Rellenos con texto encima (C2): botones, cintas y badges de acento y de
  // primario. Conservan el texto de hoy y ajustan el relleno lo mínimo; si
  // hace falta más de un 20 %, conservan el relleno y cambian el texto.
  const accentFill = readableFill(config.colorAccent, contrastColor(config.colorAccent));
  set('--color-accent-fill', accentFill.fill);
  set('--color-on-accent-aa', accentFill.text);
  const primaryFill = readableFill(config.colorPrimary, contrastColor(config.colorPrimary));
  set('--color-primary-fill', primaryFill.fill);
  set('--color-on-primary-aa', primaryFill.text);
  set('--color-primary-ink', accentInk(config.colorPrimary, config.colorBackground, config.colorSecondary));
  // Texto atenuado (opacity-60/70/80) sobre el relleno primario, ej. el
  // newsletter: la opacidad mínima con la que el texto sigue en AA. Las clases
  // de opacidad dentro de .bg-primary toman max(la suya, esta) en v2.
  const pFill = parseHex(primaryFill.fill);
  const pText = parseHex(primaryFill.text);
  set('--on-primary-min-alpha', pFill && pText ? String(minAlphaForContrast(pText, [pFill], 0, 4.5)) : '0');
  // Badges "outline": pastilla blanca fija, texto del color del badge.
  set('--color-accent-ink-on-white', accentInk(config.colorAccent, '#ffffff'));
  // Estados (C5): tinta sobre el fondo del comercio y relleno de "agregado".
  for (const [name, base] of Object.entries(STATUS_BASE)) {
    set(`--color-${name}-ink`, accentInk(base, config.colorBackground, config.colorSecondary));
  }
  const successFill = readableFill(STATUS_BASE.success, '#ffffff');
  set('--color-success-fill', successFill.fill);
  set('--color-on-success', successFill.text);

  set('--font-heading', `'${config.fontHeading}', system-ui, sans-serif`);
  set('--font-body', `'${config.fontBody}', system-ui, sans-serif`);

  // Escala global del texto. TODOS los tamaños de la tienda se escriben como
  // `calc(Npx * var(--font-scale, 1))`, así que con 1 la tienda renderiza
  // exactamente lo de siempre y el comercio puede agrandar sin que toquemos
  // nada. Es por canal: minorista y mayorista tienen su propio `settings`.
  set('--font-scale', String(config.fontScale));

  // Versión tipográfica (lib/typography). Los roles `ty-*` de globals.css sólo
  // aplican bajo data-typography="v2", así que en v1 estos atributos no cambian
  // nada de lo que se ve.
  const typo = typographyFor(config);
  root.dataset.typography = typo.version;
  root.dataset.titleCase = typo.titleCase;

  // Esquinas. `rounded-full` NO sale de acá a propósito: es literal en el config
  // de Tailwind, para que elegir "recto" no convierta en cuadrados los swatches
  // de color ni los avatares.
  const scale = CORNER_SCALES[config.corners] ?? CORNER_SCALES.rounded;
  for (const [step, value] of Object.entries(scale)) set(`--radius-${step}`, value);
  set('--radius-button', BUTTON_RADII[config.buttonCorners] ?? BUTTON_RADII.rounded);
}

const FONT_LINK_ID = 'tenant-google-fonts';

/** Carga las Google Fonts del tenant vía <link> dinámico. */
export function loadFonts(config: StoreConfig): void {
  const families = Array.from(new Set([config.fontHeading, config.fontBody]))
    .filter(Boolean)
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800;900`)
    .join('&');
  if (!families) return;

  const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = href;
}

function setFavicon(href: string): void {
  let icon = document.getElementById('favicon') as HTMLLinkElement | null;
  if (!icon) {
    icon = document.createElement('link');
    icon.id = 'favicon';
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  // El <link> de index.html declara type="image/svg+xml" (la "P" por
  // defecto). Si queda ese type con un PNG/JPG del tenant, el navegador
  // puede ignorarlo y seguir mostrando la "P".
  icon.removeAttribute('type');
  icon.href = href;
}

// Evita que un logo que termina de cargar tarde pise un favicon más nuevo
// (la config se re-aplica en vista previa del editor).
let faviconRequest = 0;

/** Aplica favicon, título y meta description del tenant. */
export function applyDocumentMeta(config: StoreConfig): void {
  if (config.metaTitle) document.title = config.metaTitle;

  const request = ++faviconRequest;
  if (config.faviconUrl) {
    setFavicon(config.faviconUrl);
  } else if (config.logoUrl) {
    // Sin favicon cargado, usamos el logo solo si es más o menos cuadrado:
    // un logo horizontal a 16px queda ilegible, y ahí es mejor la "P".
    const img = new Image();
    img.onload = () => {
      if (request !== faviconRequest || !img.naturalWidth || !img.naturalHeight) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      if (ratio >= 0.8 && ratio <= 1.25) setFavicon(config.logoUrl);
    };
    img.src = config.logoUrl;
  }

  if (config.metaDescription) {
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = config.metaDescription;
  }
}
