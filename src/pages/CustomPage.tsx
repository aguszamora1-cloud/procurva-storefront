import { useParams } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { Seo } from '@/components/Seo';
import { RouteNotFound } from '@/pages/RouteNotFound';

/**
 * Página de texto que el comercio publica desde el editor visual (Menú de
 * navegación → Página de texto). Ej: Cambios, Preguntas frecuentes, Cuidados.
 *
 * El contenido NO se pide al backend: viaja dentro del `settings` de la tienda
 * que ya resolvió StoreProvider, así que la página pinta en el primer frame y
 * no necesita gate de first paint ni estado de carga.
 */
export function CustomPage() {
  const { slug = '' } = useParams();
  const config = useStore();

  const page = config.menuItems.find((item) => item.kind === 'page' && item.slug === slug);

  // Slug inexistente (o página que el comercio despublicó/vació): 404 real de la
  // tienda, no una pantalla en blanco con el título de la ruta.
  if (!page || page.kind !== 'page') return <RouteNotFound />;

  // Un párrafo por bloque separado por línea en blanco; dentro del párrafo, los
  // saltos simples se respetan (`whitespace-pre-line`). Es texto plano a
  // propósito: el campo del editor es un textarea, no un editor rico, así que
  // nunca hay HTML que sanitizar.
  const paragraphs = page.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:py-14">
      <Seo
        title={`${page.label} · ${config.name}`}
        description={paragraphs[0]?.slice(0, 160) || config.metaDescription}
        image={config.ogImageUrl}
        slug={config.slug}
        siteName={config.name}
      />
      <h1 className="mb-8 font-heading text-[calc(32px_*_var(--font-scale,1))] font-semibold uppercase tracking-[1px] text-text md:text-[calc(44px_*_var(--font-scale,1))]">
        {page.label}
      </h1>
      <div className="space-y-4">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line text-[calc(15px_*_var(--font-scale,1))] leading-relaxed text-muted">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
