import { SectionHeader } from '@/components/SectionHeader';
import { useTestimonials } from '@/hooks/useTestimonials';
import type { Testimonial } from '@/lib/types';

const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5 text-[15px] leading-none">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? 'text-amber-400' : 'text-line'}>
          ★
        </span>
      ))}
    </div>
  );
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <article className="flex flex-col gap-4 border border-line bg-[var(--color-background)] p-6">
      <Stars value={t.rating ?? 5} />
      <p className="flex-1 text-[14px] leading-relaxed text-text md:text-[15px]">“{t.text}”</p>
      <div className="flex items-center gap-3">
        {t.customer_photo_url ? (
          <img src={t.customer_photo_url} alt={t.customer_name} loading="lazy" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-text">
            {initials(t.customer_name)}
          </span>
        )}
        <span className="text-[13px] font-semibold uppercase tracking-[0.5px] text-text">{t.customer_name}</span>
      </div>
    </article>
  );
}

/** Sección de testimonios / reseñas (Social Proof, Extra PRO). */
export function SocialProofSection() {
  const { testimonials } = useTestimonials();
  if (testimonials.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
      <SectionHeader label="Lo que dicen" title="Reseñas de clientes" />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {testimonials.map((t) => (
          <TestimonialCard key={t.id} t={t} />
        ))}
      </div>
    </section>
  );
}
