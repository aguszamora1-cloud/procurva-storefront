import { SectionHeader } from '@/components/SectionHeader';
import type { CustomSection, CustomSectionVideoContent } from '@/lib/types';

/**
 * Video del home: YouTube, Vimeo o un archivo propio (mp4/webm).
 *
 * Es distinto de la sección Videos (catalog_reels), que son verticales, van en
 * carrusel y salen de un pool aparte. Acá es UN video, en el lugar que el
 * comercio quiera, y sirve para el típico video institucional o de un lanzamiento.
 */

const ASPECT: Record<string, string> = {
  '16:9': 'aspect-video',
  '9:16': 'aspect-[9/16]',
  '1:1': 'aspect-square',
};

/**
 * URL de embed a partir de lo que el comercio pega en el navegador. Acepta las
 * tres formas de YouTube (watch, youtu.be, shorts) y Vimeo; devuelve null si es
 * un archivo de video directo, que va por <video> y no por iframe.
 */
function embedUrl(raw: string): string | null {
  const url = raw.trim();
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

const isFile = (url: string) => /\.(mp4|webm|ogg)(\?.*)?$/i.test(url.trim());

export function CustomVideoSection({ section }: { section: CustomSection }) {
  const c = section.content as CustomSectionVideoContent;
  const url = (c.url || '').trim();
  if (!url) return null;

  const embed = embedUrl(url);
  // Ni embed conocido ni archivo de video: no dibujamos un iframe a ciegas con
  // una URL cualquiera (queda un recuadro roto en medio de la tienda).
  if (!embed && !isFile(url)) return null;

  const aspect = ASPECT[c.aspect || '16:9'] || ASPECT['16:9'];
  const heading = (c.heading || '').trim();
  // El vertical a ancho completo queda gigante: lo acotamos como una story.
  const maxW = c.aspect === '9:16' ? 'max-w-sm' : c.aspect === '1:1' ? 'max-w-2xl' : 'max-w-4xl';

  return (
    <section
      style={c.background_color ? { backgroundColor: c.background_color } : undefined}
      className="mx-auto max-w-none px-6 py-8 md:py-16"
    >
      {heading && <SectionHeader title={heading} />}
      <div className={`mx-auto w-full ${maxW}`}>
        <div className={`relative w-full overflow-hidden bg-secondary ${aspect}`}>
          {embed ? (
            <iframe
              src={embed}
              title={heading || section.label}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <video
              src={url}
              controls
              playsInline
              // El autoplay sólo existe silenciado: con sonido el navegador lo
              // bloquea y el video queda en el primer frame, como si no anduviera.
              autoPlay={c.autoplay}
              muted={c.autoplay}
              loop={c.autoplay}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>
      </div>
    </section>
  );
}
