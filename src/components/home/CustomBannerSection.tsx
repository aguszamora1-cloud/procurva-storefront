import type { CustomSection, CustomSectionBannerContent } from '@/lib/types';

/** Banner custom: imagen full-width, con link e imagen mobile opcionales. */
export function CustomBannerSection({ section }: { section: CustomSection }) {
  const c = section.content as CustomSectionBannerContent;
  if (!c.image_url) return null;

  const img = (
    <picture>
      {c.mobile_image_url ? <source media="(max-width: 767px)" srcSet={c.mobile_image_url} /> : null}
      <img
        src={c.image_url}
        alt={c.alt_text || section.label || ''}
        loading="lazy"
        className="block w-full h-auto object-cover"
      />
    </picture>
  );

  return (
    <section className="w-full">
      {c.link_url ? (
        <a href={c.link_url} target="_blank" rel="noopener noreferrer" aria-label={c.alt_text || section.label}>
          {img}
        </a>
      ) : (
        img
      )}
    </section>
  );
}
