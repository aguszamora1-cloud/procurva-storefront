import { useState } from 'react';
import { useStore } from '@/context/StoreProvider';
import { useCoupon } from '@/context/CouponContext';
import { subscribeNewsletter } from '@/lib/newsletter';

/**
 * Sección PRO de newsletter. Suscribe vía la edge function `newsletter-welcome`,
 * que inserta el suscriptor y — si la tienda lo tiene activado — genera un cupón
 * único y se lo manda por email. El email duplicado vuelve como 'duplicate'.
 */
export function NewsletterSection() {
  const config = useStore();
  const { title, subtitle, buttonText, successMessage } = config.newsletterConfig;
  const alignClass =
    config.sectionTitleAlign === 'center' ? 'text-center' : config.sectionTitleAlign === 'right' ? 'text-right' : 'text-left';

  const { saveCoupon } = useCoupon();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'duplicate' | 'error'>('idle');
  const [generatedCoupon, setGeneratedCoupon] = useState('');
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !config.companyId) return;
    setStatus('loading');

    const res = await subscribeNewsletter(config.companyId, email.trim().toLowerCase(), name.trim(), 'section');
    if (res.status === 'error') {
      setStatus('error');
      return;
    }
    if (res.couponCode) setGeneratedCoupon(res.couponCode);
    // Guardar el cupón generado (no aplicado) para que aparezca aplicable al comprar.
    if (res.couponCode) void saveCoupon(res.couponCode, { applied: false });
    setStatus(res.status);
  };

  const copyCoupon = async () => {
    try {
      await navigator.clipboard.writeText(generatedCoupon);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard no disponible */
    }
  };

  return (
    <section className="bg-primary text-[var(--color-on-primary)]">
      <div className={`mx-auto max-w-2xl px-4 py-10 md:py-16 ${alignClass}`}>
        <h2>{title}</h2>
        <p className="mt-2 text-sm opacity-80">{subtitle}</p>

        {status === 'done' ? (
          <div className="mt-6">
            <p className="text-accent">{successMessage}</p>
            {generatedCoupon && (
              <div className="mt-3">
                <p className="text-sm opacity-80">Tu cupón de descuento (también te lo enviamos por email):</p>
                <button
                  type="button"
                  onClick={copyCoupon}
                  className="mt-1 inline-flex items-center gap-2 rounded-md border border-dashed border-[var(--color-on-primary)]/40 px-4 py-2 text-lg font-extrabold uppercase tracking-[0.15em] transition-transform hover:scale-[1.01]"
                >
                  {generatedCoupon}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                <p className="mt-1 text-[11px] opacity-60">
                  {copied ? '¡Copiado!' : 'Ya te lo guardamos — lo vas a ver aplicable cuando compres.'}
                </p>
              </div>
            )}
          </div>
        ) : status === 'duplicate' ? (
          <p className="mt-6 text-accent">Ya estás suscripto 🙌</p>
        ) : (
          <form className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row" onSubmit={submit}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre (opcional)"
              className="flex-1 border border-[var(--color-on-primary)]/30 bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-60"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Tu email"
              className="flex-1 border border-[var(--color-on-primary)]/30 bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-60"
            />
            <button type="submit" disabled={status === 'loading'} className="btn-accent px-6 py-3 text-sm disabled:opacity-60">
              {status === 'loading' ? 'Enviando…' : buttonText}
            </button>
          </form>
        )}

        {status === 'error' && (
          <p className="mt-3 text-sm text-red-300">Hubo un error. Probá de nuevo.</p>
        )}
      </div>
    </section>
  );
}
