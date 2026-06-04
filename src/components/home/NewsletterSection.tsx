import { useState } from 'react';

/**
 * Sección PRO de newsletter. Fase 1: presentacional (el storefront es de sólo
 * lectura, no escribe suscriptores). Fase 2 conecta la suscripción real.
 */
export function NewsletterSection() {
  const [done, setDone] = useState(false);

  return (
    <section className="bg-primary text-[var(--color-on-primary)]">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h2>Sumate a la lista</h2>
        <p className="mt-2 text-sm opacity-80">
          Enterate de lanzamientos y ofertas antes que nadie.
        </p>
        {done ? (
          <p className="mt-6 text-accent">¡Gracias por suscribirte!</p>
        ) : (
          <form
            className="mx-auto mt-6 flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setDone(true);
            }}
          >
            <input
              type="email"
              required
              placeholder="Tu email"
              className="flex-1 border border-[var(--color-on-primary)]/30 bg-transparent px-4 py-3 text-sm outline-none"
            />
            <button type="submit" className="btn-accent px-6 py-3 text-sm">
              Suscribirme
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
