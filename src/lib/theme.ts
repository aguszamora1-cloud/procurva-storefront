import type { StoreConfig } from './types';

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

  set('--font-heading', `'${config.fontHeading}', system-ui, sans-serif`);
  set('--font-body', `'${config.fontBody}', system-ui, sans-serif`);
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

/** Aplica favicon, título y meta description del tenant. */
export function applyDocumentMeta(config: StoreConfig): void {
  if (config.metaTitle) document.title = config.metaTitle;

  if (config.faviconUrl) {
    let icon = document.getElementById('favicon') as HTMLLinkElement | null;
    if (!icon) {
      icon = document.createElement('link');
      icon.id = 'favicon';
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.href = config.faviconUrl;
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
