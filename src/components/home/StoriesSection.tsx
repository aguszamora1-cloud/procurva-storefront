import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStories } from '@/hooks/useStories';
import type { Story } from '@/lib/types';

/**
 * Fila horizontal de stories circulares (estilo Instagram). Al tocar una story:
 * si tiene link_url navega; si no, abre la imagen en un lightbox.
 */
export function StoriesSection() {
  const { stories } = useStories();
  const navigate = useNavigate();
  const [lightbox, setLightbox] = useState<Story | null>(null);

  if (stories.length === 0) return null;

  const open = (s: Story) => {
    const link = s.link_url?.trim();
    if (link) {
      if (/^https?:\/\//.test(link)) window.open(link, '_blank', 'noopener,noreferrer');
      else navigate(link);
    } else {
      setLightbox(s);
    }
  };

  return (
    <section className="mx-auto max-w-none px-6 pt-10 md:pt-14">
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stories.map((s) => (
          <button
            key={s.id}
            onClick={() => open(s)}
            className="flex shrink-0 flex-col items-center gap-1.5"
            title={s.title}
          >
            <span className="rounded-full bg-gradient-to-tr from-accent to-primary p-[2px]">
              <span className="block rounded-full bg-[var(--color-background)] p-[2px]">
                <img
                  src={s.image_url}
                  alt={s.title}
                  loading="lazy"
                  className="h-16 w-16 rounded-full object-cover md:h-20 md:w-20"
                />
              </span>
            </span>
            <span className="max-w-[72px] truncate text-[11px] font-medium text-text md:max-w-[88px] md:text-xs">
              {s.title}
            </span>
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.image_url}
            alt={lightbox.title}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-5 top-5 text-3xl leading-none text-white/80 hover:text-white"
            aria-label="Cerrar"
          >
            &times;
          </button>
        </div>
      )}
    </section>
  );
}
