import { useState } from 'react';
import { useStore } from '@/context/StoreProvider';
import { supabase } from '@/lib/supabase';

/**
 * Sección PRO de newsletter. Inserta el suscriptor en
 * `catalog_newsletter_subscribers` (anon puede INSERT en catálogos habilitados).
 * El email duplicado se detecta por la violación de UNIQUE(company_id, email).
 */
export function NewsletterSection() {
  const config = useStore();
  const { title, subtitle, buttonText, successMessage } = config.newsletterConfig;
  const alignClass =
    config.sectionTitleAlign === 'center' ? 'text-center' : config.sectionTitleAlign === 'right' ? 'text-right' : 'text-left';

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'duplicate' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !config.companyId) return;
    setStatus('loading');

    const { error } = await supabase.from('catalog_newsletter_subscribers').insert({
      company_id: config.companyId,
      email: email.trim().toLowerCase(),
      name: name.trim() || null,
      source: 'section',
    });

    if (error) {
      // 23505 = unique_violation → ya está suscripto.
      if (error.code === '23505') {
        setStatus('duplicate');
      } else {
        console.error('Error al suscribir al newsletter:', error);
        setStatus('error');
      }
      return;
    }
    setStatus('done');
  };

  return (
    <section className="bg-primary text-[var(--color-on-primary)]">
      <div className={`mx-auto max-w-2xl px-4 py-16 ${alignClass}`}>
        <h2>{title}</h2>
        <p className="mt-2 text-sm opacity-80">{subtitle}</p>

        {status === 'done' ? (
          <p className="mt-6 text-accent">{successMessage}</p>
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
