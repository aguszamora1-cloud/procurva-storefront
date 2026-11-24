/**
 * T5 · Contenido del comercio dentro de una plantilla.
 *
 * Las plantillas tienen su propia composición del home (portada, ingresos,
 * categorías…). Lo que el comercio cargó aparte (secciones personalizadas: FAQ,
 * franjas, videos, banners…; reseñas; newsletter; videos e historias;
 * beneficios) se pinta con los MISMOS componentes de Classic, en el orden de la
 * tienda (lib/homeOrder) y con la paleta, tipografía y esquinas de la plantilla:
 *
 *  - Las variables CSS del tema (lib/theme · themeVars) se recalculan con la
 *    paleta de la plantilla y se ponen en el contenedor: las clases de Classic
 *    (`text-text`, `bg-primary`, `border-line`…) ya leen de ahí, sin tocar un solo
 *    componente. Los grises y rellenos con contraste AA se derivan igual que en
 *    Classic, así que sobre el negro de Distrito también se leen.
 *  - StoreConfigOverride le pasa la misma paleta a lo que calcula colores en
 *    código (useInk, el popup del newsletter).
 *  - Los colores que el comercio eligió PARA una sección (fondo de una franja, de
 *    un FAQ) se respetan: son contenido, no tema.
 *
 * Outfits NO se pintan en la v1 (ver lib/outfitsGate: la activación se bloquea
 * si la tienda los muestra).
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { StoreConfigOverride, useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { useCustomSections } from '@/hooks/useCustomSections';
import { ContrastScope } from '@/components/ContrastScope';
import { Reveal } from '@/components/Reveal';
import { PreviewSection } from '@/components/PreviewSection';
import { PromoBannerAuto } from '@/components/PromoBannerAuto';
import { TrustBadges } from '@/components/TrustBadges';
import { NewsletterSection } from '@/components/home/NewsletterSection';
import { NewsletterPopup } from '@/components/NewsletterPopup';
import { PromoBanner } from '@/components/PromoBanner';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { marqueeMessages } from '@/components/MarqueeStrip';
import { StoriesSection } from '@/components/home/StoriesSection';
import { ReelsSection } from '@/components/home/ReelsSection';
import { SocialProofSection } from '@/components/home/SocialProofSection';
import { customSectionNode, customSectionSkipsReveal } from '@/components/home/customSectionNode';
import { customSectionKey, homeSectionEnabled, orderHomeKeys, placeAroundNatives, type FixedHomeKey } from '@/lib/homeOrder';
import { themeVars } from '@/lib/theme';
import { contrastRatio, minAlphaForContrast, parseHex } from '@/lib/contrast';
import type { ButtonCornerStyle, CornerStyle, CustomSection, StoreConfig } from '@/lib/types';

const sameColor = (a: unknown, b: unknown): boolean =>
  typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Una sección con el MISMO fondo que la tienda en Classic no eligió un fondo: lo
 * igualó a la página (típico: blanco sobre blanco). Dentro de la plantilla ese
 * fondo quedaría como una banda pegada sobre el papel o el negro, así que se
 * toma como «sin fondo» y la sección queda sobre el fondo de la plantilla. Un
 * fondo DISTINTO (una franja roja, un bloque gris) es contenido y se respeta.
 */
export function adaptSectionToTemplate(cs: CustomSection, storeBackground: string): CustomSection {
  const content = cs.content as unknown as Record<string, unknown> | null;
  if (!content || !sameColor(content.background_color, storeBackground)) return cs;
  return { ...cs, content: { ...content, background_color: undefined } as unknown as CustomSection['content'] };
}

/** Paleta y tipografía de una plantilla, en los términos del tema de Classic. */
export interface TemplateInk {
  background: string;
  text: string;
  /** Relleno de bloques llenos (newsletter, botones primarios). */
  primary: string;
  accent: string;
  /** Superficie secundaria (tarjetas, paneles). */
  secondary: string;
  /** Familias (deben estar en el fontsHref del kit). */
  headingFamily: string;
  bodyFamily: string;
  /** Pila completa para las variables CSS (con los respaldos de la plantilla). */
  headingStack: string;
  bodyStack: string;
  corners: CornerStyle;
  buttonCorners: ButtonCornerStyle;
  /** Alineación de los títulos de sección (la de la plantilla, no la de Classic). */
  titleAlign: 'left' | 'center';
}

function inkPatch(ink: TemplateInk): Partial<StoreConfig> {
  return {
    colorBackground: ink.background,
    colorText: ink.text,
    colorPrimary: ink.primary,
    colorAccent: ink.accent,
    colorSecondary: ink.secondary,
    fontHeading: ink.headingFamily,
    fontBody: ink.bodyFamily,
    corners: ink.corners,
    buttonCorners: ink.buttonCorners,
    sectionTitleAlign: ink.titleAlign,
  };
}

/**
 * Texto sobre el relleno primario (newsletter, botones llenos). Classic elige
 * blanco o negro por luminancia y, si no llega a AA, corre el RELLENO hasta 4,5
 * justos (con el texto atenuado al 80 % quedaba en 4,49 sobre el naranja de
 * Distrito). Acá el relleno es de la plantilla y no se toca: se elige el texto
 * (tinta de la plantilla o blanco) que más contrasta con él y, si pasa AA con
 * margen, se fija con su opacidad mínima. Si ninguno llega, queda lo de Classic.
 */
export function onPrimaryVars(primary: string, dark = '#0e0e0e'): Record<string, string> {
  const fill = parseHex(primary);
  if (!fill) return {};
  const options = [dark, '#ffffff'].map((c) => ({ c, ratio: contrastRatio(parseHex(c)!, fill) }));
  const best = options.sort((a, b) => b.ratio - a.ratio)[0];
  if (best.ratio < 4.6) return {};
  return {
    '--color-on-primary': best.c,
    '--color-on-primary-aa': best.c,
    '--color-primary-fill': primary,
    '--on-primary-min-alpha': String(minAlphaForContrast(parseHex(best.c)!, [fill], 0, 4.6)),
  };
}

/**
 * Superficie con el tema de la plantilla. `bare`: sin caja (display: contents),
 * para lo que sale fijo en pantalla como el popup.
 */
export function StoreSurface({ ink, bare, children }: { ink: TemplateInk; bare?: boolean; children: ReactNode }) {
  const config = useStore();
  const patch = useMemo(() => inkPatch(ink), [ink]);
  const style = useMemo(() => {
    const vars: Record<string, string> = { ...themeVars({ ...config, ...patch }), ...onPrimaryVars(ink.primary) };
    vars['--font-heading'] = ink.headingStack;
    vars['--font-body'] = ink.bodyStack;
    return vars as CSSProperties;
  }, [config, patch, ink.headingStack, ink.bodyStack]);
  return (
    <StoreConfigOverride patch={patch}>
      <div className={bare ? 'tpl-store tpl-store--bare' : 'tpl-store'} style={style}>
        <ContrastScope>{children}</ContrastScope>
      </div>
    </StoreConfigOverride>
  );
}

/**
 * Popup del newsletter (mismo componente, disparo y condiciones que Classic).
 * Es una caja con los colores que eligió el comercio para el popup, así que NO
 * toma la paleta de la plantilla (sobre el negro de Distrito los grises del
 * tema dejaban los campos ilegibles en una caja blanca): sólo las tipografías.
 */
export function TemplateNewsletterPopup({ ink }: { ink: TemplateInk }) {
  const style = { '--font-heading': ink.headingStack, '--font-body': ink.bodyStack } as CSSProperties;
  return (
    <div className="tpl-store--bare" style={style}>
      <NewsletterPopup />
    </div>
  );
}

/** ¿La tienda tiene mensajes en la barra de anuncios? (los mismos que muestra Classic). */
export function useHasAnnouncement(): boolean {
  return marqueeMessages(useStore().announcement).length > 0;
}

/**
 * Franjas de arriba de Classic (Layout): la franja promocional PRO (evento con
 * cuenta regresiva) y la barra de anuncios del comercio. Son texto comercial que
 * la tienda ya publica («10 % superando $160.000», «Envío gratis en Rosario»):
 * sin esto, cambiar de plantilla las haría desaparecer. Van arriba del
 * encabezado de la plantilla, con su paleta; se ocultan solas con las mismas
 * condiciones que en Classic (sin texto, no PRO, cuenta regresiva terminada).
 * La posición «debajo del menú» de la franja promo no se replica: en la v1 va
 * siempre arriba. `announcement={false}`: la plantilla muestra los anuncios en
 * su propia barra (Momentum).
 */
export function TemplateTopBars({ ink, announcement = true }: { ink: TemplateInk; announcement?: boolean }) {
  const hasAnnouncement = useHasAnnouncement() && announcement;
  return (
    <StoreSurface ink={ink} bare>
      <PromoBanner />
      {hasAnnouncement && <AnnouncementBar />}
    </StoreSurface>
  );
}

/** Secciones fijas que una plantilla delega en Classic (las demás son propias o no van en la v1). */
const EXTRA_FIXED: readonly FixedHomeKey[] = ['trust_badges', 'reels', 'stories', 'social_proof', 'newsletter'];

/** Bloques propios de la plantilla: qué keys de Classic cubre cada uno, en el orden en que los pinta. */
export type TemplateNatives = readonly (readonly FixedHomeKey[])[];

export interface StoreHomeExtras {
  /** Contenido del comercio que va en la posición `i` (0 = antes del primer bloque propio; i = después del bloque i-1). */
  slot: (i: number) => ReactNode;
  /** ¿El comercio tiene prendida esta sección? (misma regla que Classic). */
  on: (key: FixedHomeKey) => boolean;
  /** Keys de Classic que se pintan en cada posición (para pruebas y depuración). */
  placement: string[][];
}

/**
 * Contenido del comercio para el home de una plantilla. `natives` describe los
 * bloques propios de la plantilla; el resto se ubica a su alrededor con el orden
 * de la tienda (placeAroundNatives).
 */
export function useStoreHomeExtras(natives: TemplateNatives, ink: TemplateInk): StoreHomeExtras {
  const config = useStore();
  const { sections: customSections, isLoading } = useCustomSections();
  // Igual que Classic: las secciones personalizadas se intercalan en cualquier
  // posición, así que la portada espera a tenerlas (si no, aparecen después y
  // corren todo lo de abajo).
  useFirstPaintGate('tpl-home-custom-sections', isLoading);

  const on = (key: FixedHomeKey) => homeSectionEnabled(key, config);

  const nodes: Record<string, ReactNode> = {};
  const noReveal = new Set<string>(['trust_badges']);
  if (on('trust_badges')) nodes.trust_badges = <TrustBadges background={config.trustBadgesBgColor || undefined} />;
  if (on('stories')) nodes.stories = <StoriesSection />;
  if (on('reels')) nodes.reels = <ReelsSection />;
  if (on('social_proof')) nodes.social_proof = <SocialProofSection />;
  if (on('newsletter')) nodes.newsletter = <NewsletterSection />;
  const customKeys: string[] = [];
  for (const cs of customSections) {
    const key = customSectionKey(cs.id);
    customKeys.push(key);
    if (customSectionSkipsReveal(cs)) noReveal.add(key);
    const node = customSectionNode(adaptSectionToTemplate(cs, config.colorBackground));
    if (node) nodes[key] = node;
  }

  const ordered = orderHomeKeys(config.sectionsOrder, customKeys);
  const extras = new Set<string>([...EXTRA_FIXED.filter((k) => k in nodes), ...customKeys.filter((k) => k in nodes)]);
  const placement = placeAroundNatives(ordered, natives, extras);

  const slot = (i: number): ReactNode => {
    const keys = placement[i] ?? [];
    const promo = i === 0 ? <PromoBannerAuto /> : null;
    if (keys.length === 0 && !promo) return null;
    return (
      <StoreSurface ink={ink}>
        {/* Banner de promoción de tienda completa: arriba de todo, como en Classic. */}
        {promo}
        {keys.map((key) =>
          noReveal.has(key) ? (
            <PreviewSection key={key} id={key}>
              {nodes[key]}
            </PreviewSection>
          ) : (
            <PreviewSection key={key} id={key}>
              <Reveal>{nodes[key]}</Reveal>
            </PreviewSection>
          ),
        )}
      </StoreSurface>
    );
  };

  return { slot, on, placement };
}
