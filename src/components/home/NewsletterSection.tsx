import { useState } from 'react';
import { useStore } from '@/context/StoreProvider';
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

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'duplicate' | 'error'>('idle');
  const [generatedCoupon, setGeneratedCoupon] = useState('');

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
    setStatus(res.status);
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
                <p className="mt-1 inline-block rounded-md border border-dashed border-[var(--color-on-primary)]/40 px-4 py-2 text-lg font-extrabold uppercase tracking-[0.15em]">
                  {generatedCoupon}
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
