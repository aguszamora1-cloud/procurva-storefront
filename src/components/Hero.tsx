import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { useBanners } from '@/hooks/useBanners';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { transformedSrc } from '@/lib/images';

const ROTATE_MS = 6000;

/**
 * Clases del botón del hero según lo que eligió el comercio (Catálogo Online →
 * Banner principal → Botón). Los defaults reproducen el look que el hero tenía
 * hardcodeado: `rounded-md`, tamaño mediano, color de marca.
 */
const CTA_SHAPE: Record<string, string> = {
  rounded: 'rounded-md',
  square: 'rounded-none',
  pill: 'rounded-full',
};

// Cuerpos más grandes que los de antes: el texto dejó de ir en mayúsculas y en
// minúscula el mismo tamaño se lee mucho más chico.
const CTA_SIZE: Record<string, string> = {
  sm: 'px-6 py-2.5 text-[calc(13px_*_var(--font-scale,1))] md:px-7 md:text-[calc(14px_*_var(--font-scale,1))]',
  md: 'px-8 py-4 text-[calc(15px_*_var(--font-scale,1))] md:px-10 md:text-[calc(16px_*_var(--font-scale,1))]',
  lg: 'px-10 py-5 text-[calc(17px_*_var(--font-scale,1))] md:px-14 md:text-[calc(18px_*_var(--font-scale,1))]',
};

// 'light'/'dark' son colores fijos a propósito: el CTA va sobre una foto, no
// sobre el fondo del tema, así que seguir los tokens de superficie lo volvería
// invisible en la mitad de las imágenes.
const CTA_VARIANT: Record<string, string> = {
  accent: 'bg-accent text-on-accent shadow-lg',
  light: 'bg-white text-black shadow-lg',
  dark: 'bg-black text-white shadow-lg',
  outline: 'border-2 border-white bg-transparent text-white hover:bg-white hover:text-black',
};

function ctaClass(cta: { shape: string; size: string; variant: string }): string {
  return [
    'inline-flex items-center justify-center font-medium transition-all duration-200 hover:scale-[1.02]',
    CTA_SHAPE[cta.shape] ?? CTA_SHAPE.rounded,
    CTA_SIZE[cta.size] ?? CTA_SIZE.md,
    CTA_VARIANT[cta.variant] ?? CTA_VARIANT.accent,
  ].join(' ');
}

interface Slide {
  /** Imagen ya resuelta para el dispositivo actual. */
  image: string;
  link: string | null;
}

/** ¿URL renderizable? (no vacía, http(s) o ruta absoluta). */
function isRenderable(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/');
}

/** El mismo corte de 767px que usaba el <picture>, pero legible desde JS. */
const MOBILE_QUERY = '(max-width: 767px)';

/**
 * ¿Estamos en celular? Antes esto lo resolvía el `<source media>` del
 * `<picture>`, pero la lista de slides ahora DEPENDE del dispositivo (un banner
 * puede ir sólo en celular), y la rotación con su índice y sus puntitos es
 * estado de React: el CSS solo no alcanza para sacar un slide de la vuelta.
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    onChange();
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

export function Hero() {
  const config = useStore();
  const { banners, isLoading } = useBanners();
  const isMobile = useIsMobile();
  const [idx, setIdx] = useState(0);
  // Si la transformación de Supabase (render/image) falla, caemos a la URL
  // original. Las imágenes nunca quedan rotas.
  const [transformFailed, setTransformFailed] = useState(false);
  // La primera imagen del hero ya se descargó (o no hay ninguna que esperar).
  const [firstImageReady, setFirstImageReady] = useState(false);
  // Proporción REAL de la primera imagen, medida al cargarla. Sólo la usa el
  // encuadre 'contain': es lo que le da el alto al banner para que la imagen
  // entre entera. Se remide sola cuando el <picture> cambia de fuente al
  // cruzar los 767px, así que mobile y escritorio quedan cada uno con la suya.
  const [ratio, setRatio] = useState<number | null>(null);

  // Qué imagen le toca a este dispositivo. En celular manda la mobile y la de
  // escritorio queda de respaldo; en escritorio SÓLO vale la de escritorio.
  //
  // De ahí sale lo importante: un banner al que le vaciaron la imagen de
  // escritorio se muestra únicamente en celular y no entra en la rotación de
  // PC. Es la salida para el comercio que tiene las creatividades verticales
  // del teléfono y todavía no armó las apaisadas: en vez de mostrarlas
  // recortadas a la mitad en una pantalla grande, no las muestra.
  const pick = (desktop: string | null | undefined, mobile: string | null | undefined): string => {
    if (isMobile && isRenderable(mobile)) return (mobile as string).trim();
    return isRenderable(desktop) ? (desktop as string).trim() : '';
  };

  const fromBanners: Slide[] = banners
    .map((b) => ({ image: pick(b.image_url, b.image_url_mobile), link: b.link_url }))
    .filter((s) => s.image);
  const single = pick(config.heroImageUrl, config.heroImageMobileUrl);
  const slides: Slide[] =
    fromBanners.length > 0 ? fromBanners : single ? [{ image: single, link: null }] : [];

  // Al cruzar los 767px la lista puede achicarse (los banners de sólo-celular
  // desaparecen): sin esto el índice quedaría apuntando fuera del array.
  const safeIdx = idx < slides.length ? idx : 0;

  const srcFor = (url: string, width: number) => (transformFailed ? url : transformedSrc(url, { width }));

  // Gate del primer paint: la tienda queda tapada hasta tener los banners Y la
  // imagen principal ya descargada. Sin esto el banner era lo último en aparecer,
  // después del navbar y las categorías.
  useFirstPaintGate('hero', isLoading || (slides.length > 0 && !firstImageReady));

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  // Debug: qué URL está usando el hero (transformada vs original).
  const activeImage = slides[safeIdx]?.image;
  useEffect(() => {
    if (activeImage) {
      console.log('[Hero] imagen usada:', transformFailed ? activeImage : transformedSrc(activeImage, { width: 1600 }), '| original:', activeImage);
    }
  }, [activeImage, transformFailed]);

  // 'Solo imagen' apaga textos y botón aunque estén cargados: es un modo, no un
  // borrado (el comercio conserva lo escrito para cuando vuelva a 'Imagen con
  // textos'). 'auto' = tiendas que nunca tocaron el selector → como antes.
  const heroTextAllowed = config.heroMode !== 'image_only';
  const hasText = heroTextAllowed && Boolean(config.heroTitle); // sólo hero_title (no banner_text)
  const hasCta = heroTextAllowed && Boolean(config.heroCtaText); // sólo si el comercio cargó el texto
  const ctaCls = ctaClass(config.heroCta);
  // El CTA puede apuntar afuera (Instagram, un formulario): las URL absolutas
  // salen por <a> en otra pestaña; las rutas internas por <Link>, sin recargar.
  const ctaIsExternal = /^https?:\/\//i.test(config.heroCtaLink);
  const ctaNode = hasCta
    ? ctaIsExternal
      ? (
          <a href={config.heroCtaLink} target="_blank" rel="noreferrer" className={ctaCls}>
            {config.heroCtaText}
          </a>
        )
      : (
          <Link to={config.heroCtaLink} className={ctaCls}>
            {config.heroCtaText}
          </Link>
        )
    : null;

  // Encuadre en escritorio (Catálogo Online → Banner principal → Encuadre):
  //  - 'cover'   → alto de pantalla y la imagen se recorta para llenarlo. Es el
  //                default y lo que la tienda venía haciendo siempre.
  //  - 'contain' → el alto sale de la proporción REAL de la imagen, así que se
  //                ve entera. Es la salida para el comercio que sube fotos que
  //                no son apaisadas (el caso típico: la creatividad de mobile).
  const fitContain = config.heroFit === 'contain';
  // Caja del banner. En 'contain' el alto lo pone `aspect-ratio` en línea, con
  // el mismo placeholder de 'cover' mientras no sepamos todavía la proporción.
  // El `max-h-screen` de 'contain' es un tope de cordura, no un recorte de
  // diseño: sin él, una imagen vertical cargada como la de escritorio genera un
  // banner de tres pantallas de alto y la tienda no se ve. Al topearse, la
  // imagen queda con bandas al costado — que es justamente el aviso visual de
  // que esa imagen no va ahí.
  const boxCls = fitContain
    ? 'relative w-full max-h-screen overflow-hidden bg-primary'
    : 'relative aspect-[4/5] max-h-[680px] w-full overflow-hidden bg-primary md:aspect-auto md:max-h-none md:h-screen';
  const boxStyle = fitContain && ratio ? { aspectRatio: String(ratio) } : undefined;
  const boxFallbackCls = fitContain && !ratio ? ' aspect-[4/5] md:aspect-[2/1]' : '';

  if (isLoading && slides.length === 0) {
    // Mismo alto que el hero real: si el esqueleto mide distinto, la página
    // pega un salto justo cuando entra la imagen.
    return (
      <section
        className={`w-full bg-secondary ${
          fitContain ? 'aspect-[4/5] md:aspect-[2/1]' : 'aspect-[4/5] max-h-[680px] md:aspect-auto md:max-h-none md:h-screen'
        }`}
      />
    );
  }

  // Sin imágenes: hero editorial sólo si hay texto configurado. Si no, no hay hero.
  if (slides.length === 0) {
    if (!hasText) return null;
    return (
      <section className="relative bg-primary text-[var(--color-on-primary)]">
        <div className="mx-auto max-w-none px-6 py-24 md:px-12 md:py-40">
          <h1 className="max-w-3xl font-heading text-[calc(44px_*_var(--font-scale,1))] font-extrabold uppercase leading-[1] tracking-[-0.5px] md:text-[calc(88px_*_var(--font-scale,1))]">
            {config.heroTitle}
          </h1>
          {config.heroSubtitle && (
            <p className="mt-6 max-w-md text-[calc(15px_*_var(--font-scale,1))] text-[var(--color-on-primary)]/75 md:text-[calc(17px_*_var(--font-scale,1))]">
              {config.heroSubtitle}
            </p>
          )}
          {ctaNode && <div className="mt-10">{ctaNode}</div>}
        </div>
      </section>
    );
  }

  const slide = slides[safeIdx];
  const showText = hasText;

  const media = (
    <div className={boxCls + boxFallbackCls} style={boxStyle}>
      {slides.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === safeIdx ? 'z-10 opacity-100' : 'z-0 opacity-0'
          }`}
        >
          {/* Sin <picture>: la imagen del dispositivo ya la eligió `pick`, que
              es el mismo que decide qué banners entran en la rotación. Tener
              las dos reglas (cuál se ve y cuáles rotan) en un solo lugar es lo
              que evita que se contradigan. */}
          <img
              key={s.image}
              src={srcFor(s.image, isMobile ? 768 : 1600)}
              alt={config.name}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding={i === 0 ? 'sync' : 'async'}
              fetchPriority={i === 0 ? 'high' : 'auto'}
              onLoad={(e) => {
                if (i !== 0) return;
                setFirstImageReady(true);
                // La proporción se mide sobre la imagen que se está mostrando,
                // así que al cruzar los 767px se vuelve a tomar sola con la del
                // otro dispositivo.
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                if (w && h) setRatio(w / h);
              }}
              onError={() => {
                if (!transformFailed) {
                  console.warn('[Hero] imagen transformada falló, usando original:', s.image);
                  setTransformFailed(true);
                  return;
                }
                // Ya reintentamos con la original y también falló: destrabamos el
                // gate igual, no vamos a dejar la tienda tapada por una imagen rota.
                if (i === 0) setFirstImageReady(true);
              }}
              className={`absolute inset-0 h-full w-full ${fitContain ? 'object-contain' : 'object-cover'}`}
            />
        </div>
      ))}

    </div>
  );

  // Gradiente + texto/CTA al pie (estilo RSW). Sólo si hay algo que mostrar.
  // Va FUERA del <a> del banner: un botón adentro de otro link es HTML inválido
  // y el click terminaba abriendo el link del slide en vez del destino del CTA.
  // La capa no intercepta clicks (pointer-events-none); sólo el botón sí.
  const overlay = (showText || hasCta) && (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto max-w-none px-6 py-12 md:px-12 md:py-16">
          {showText && (
            <div className="mb-5 max-w-2xl text-white">
              {config.heroTitle && (
                <h1 className="font-heading text-[calc(36px_*_var(--font-scale,1))] font-extrabold uppercase leading-[1.02] tracking-[-0.5px] drop-shadow md:text-[calc(64px_*_var(--font-scale,1))]">
                  {config.heroTitle}
                </h1>
              )}
              {config.heroSubtitle && (
                <p className="mt-3 max-w-xl text-[calc(14px_*_var(--font-scale,1))] text-white/85 md:text-[calc(17px_*_var(--font-scale,1))]">{config.heroSubtitle}</p>
              )}
            </div>
          )}
          {ctaNode && <div className="pointer-events-auto inline-block">{ctaNode}</div>}
        </div>
      </div>
    </div>
  );

  return (
    <section className="relative">
      {slide.link ? (
        <a href={slide.link} target="_blank" rel="noreferrer">
          {media}
        </a>
      ) : (
        media
      )}

      {overlay}

      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Ir al slide ${i + 1}`}
              className={`h-1 rounded-full transition-all ${i === safeIdx ? 'w-8 bg-white' : 'w-4 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
