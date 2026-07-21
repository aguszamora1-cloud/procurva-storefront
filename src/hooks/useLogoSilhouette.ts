import { useEffect, useState } from 'react';
import { luminance } from '@/lib/theme';

/**
 * ¿Hay que pintar el logo como silueta para que se lea sobre un fondo de color?
 *
 * El truco `brightness-0 invert` (silueta blanca) sirve SÓLO para logos con fondo
 * TRANSPARENTE. Aplicado a un logo opaco —el caso típico, un .jpg con fondo
 * blanco— convierte todo el rectángulo en un bloque blanco macizo: así se veía el
 * logo del footer, sin marca visible.
 *
 * Entonces medimos la imagen antes de decidir: leemos sus píxeles en un canvas
 * (el storage de Supabase manda `Access-Control-Allow-Origin: *`) y sacamos si es
 * opaca y qué tan clara es su tinta. De ahí:
 *  - opaca            → nunca filtramos (la imagen ya trae su propio fondo).
 *  - transparente y con buen contraste contra el fondo → tampoco (respetamos sus colores).
 *  - transparente y confundiéndose con el fondo → silueta blanca o negra, la que se lea.
 */
export type LogoSilhouette = 'none' | 'white' | 'black';

interface LogoAnalysis {
  /** Ningún píxel con transparencia: la imagen trae su propio fondo. */
  opaque: boolean;
  /** Luminancia media (0..1) de los píxeles visibles = qué tan clara es la tinta. */
  inkLuminance: number;
}

// Muestreamos en chico: alcanza para saber si hay alfa y qué tan clara es la tinta.
const SAMPLE_SIZE = 48;
// Píxel "transparente" y píxel que cuenta como tinta (ignoramos los casi invisibles).
const ALPHA_OPAQUE = 250;
const ALPHA_INK = 32;
// Diferencia de luminancia mínima entre la tinta y el fondo para NO tener que
// siluetear. Mismo criterio que `safeText` en lib/theme.
const MIN_CONTRAST = 0.3;

function analyzeLogo(url: string): Promise<LogoAnalysis | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Sin esto el canvas queda "tainted" y getImageData tira SecurityError.
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ratio = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
        canvas.width = SAMPLE_SIZE;
        canvas.height = Math.max(1, Math.round(SAMPLE_SIZE * ratio));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let opaque = true;
        let inkSum = 0;
        let inkCount = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < ALPHA_OPAQUE) opaque = false;
          if (alpha >= ALPHA_INK) {
            inkSum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
            inkCount += 1;
          }
        }
        resolve({ opaque, inkLuminance: inkCount > 0 ? inkSum / inkCount : 0 });
      } catch {
        // Canvas tainted (storage sin CORS) o navegador sin permiso: no sabemos.
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Fallback cuando no pudimos leer los píxeles: el formato ya dice bastante. Un
 * JPEG NUNCA tiene transparencia, así que jamás se siluetea; del resto asumimos
 * que puede ser transparente y mantenemos el comportamiento histórico.
 */
function isProbablyOpaque(url: string): boolean {
  return /\.jpe?g(\?|#|$)/i.test(url);
}

/**
 * Clase de filtro para el logo sobre un fondo `bgColor` (hex del tema).
 * Devuelve 'none' mientras mide, así que nunca se ve el bloque blanco.
 */
export function useLogoSilhouette(logoUrl: string, bgColor: string): LogoSilhouette {
  const [analysis, setAnalysis] = useState<LogoAnalysis | null | 'failed'>(null);

  useEffect(() => {
    if (!logoUrl) return;
    let cancelled = false;
    setAnalysis(null);
    analyzeLogo(logoUrl).then((result) => {
      if (!cancelled) setAnalysis(result ?? 'failed');
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  if (!logoUrl || analysis === null) return 'none';

  const bgLuminance = luminance(bgColor);
  const silhouette: LogoSilhouette = bgLuminance > 0.5 ? 'black' : 'white';

  if (analysis === 'failed') {
    // Sin medición: sólo respetamos el formato. JPEG = opaco = sin filtro.
    return isProbablyOpaque(logoUrl) ? 'none' : silhouette;
  }
  if (analysis.opaque) return 'none';
  return Math.abs(analysis.inkLuminance - bgLuminance) >= MIN_CONTRAST ? 'none' : silhouette;
}

/** Clases Tailwind por silueta (literales, para que el build las detecte). */
export const SILHOUETTE_CLASS: Record<LogoSilhouette, string> = {
  none: '',
  white: 'brightness-0 invert',
  black: 'brightness-0',
};
