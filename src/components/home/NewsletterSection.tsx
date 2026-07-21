import { useState } from 'react';
import { useStore } from '@/context/StoreProvider';
import { useCoupon } from '@/context/CouponContext';
import { subscribeNewsletter } from '@/lib/newsletter';
import { contrastColor, rgba, safeFill, safeText } from '@/lib/theme';

// Foco visible sobre el color primario (el outline del navegador no se ve sobre
// fondos oscuros). Repetido en cada control interactivo de la sección.
const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-on-primary)]';

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
  // El bloque del formulario acompaña la alineación elegida para la sección.
  const boxAlign =
    config.sectionTitleAlign === 'center' ? 'mx-auto' : config.sectionTitleAlign === 'right' ? 'ml-auto' : '';

  // La sección va sobre el color primario: el botón usa el acento sólo si se
  // distingue de ese fondo (con acento negro sobre sección negra no se veía).
  const buttonBg = safeFill(config.colorAccent, config.colorPrimary);
  const buttonFg = contrastColor(buttonBg);
  // Los mensajes de éxito usaban `text-accent` y con acento negro no se leían.
  const okColor = safeText(config.colorAccent, config.colorPrimary);
  // Borde de los campos: derivado del color de la sección. La clase
  // `border-[var(--color-on-primary)]/30` que había NO existe (Tailwind no puede
  // aplicar opacidad sobre una variable CSS), así que el borde caía al gris por
  // defecto: invisible en cualquier tienda con la sección clara.
  const fieldBorder = rgba(contrastColor(config.colorPrimary), 0.35);

  const { saveCoupon } = useCoupon();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  // El nombre es opcional y arranca oculto: un solo campo baja la fricción.
  const [showName, setShowName] = useState(false);
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
          <div className="mt-6" role="status" aria-live="polite">
            <p style={{ color: okColor }} className="font-semibold">{successMessage}</p>
            {generatedCoupon && (
              <div className="mt-3">
                <p className="text-sm opacity-80">Tu cupón de descuento (también te lo enviamos por email):</p>
                <button
                  type="button"
                  onClick={copyCoupon}
                  className={`mt-1 inline-flex items-center gap-2 rounded-md border border-dashed border-[var(--color-on-primary)]/40 px-4 py-2 text-lg font-extrabold uppercase tracking-[0.15em] transition-transform hover:scale-[1.01] ${FOCUS_RING}`}
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
          <p style={{ color: okColor }} className="mt-6 font-semibold" role="status" aria-live="polite">
            Ese email ya está suscripto.
          </p>
        ) : (
          <div className={`mt-6 max-w-md ${boxAlign}`}>
            {/* Un solo campo visible: pedir el email y nada más es lo que menos
                fricción tiene. El nombre queda a un clic para quien quiera darlo. */}
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Tu email"
                aria-label="Tu email"
                style={{ borderColor: fieldBorder }}
                className={`field-on-primary flex-1 border bg-transparent px-4 py-3 text-sm outline-none ${FOCUS_RING}`}
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{ backgroundColor: buttonBg, color: buttonFg }}
                className={`px-6 py-3 text-sm font-bold uppercase tracking-[0.03em] transition-opacity hover:opacity-90 disabled:opacity-60 ${FOCUS_RING}`}
              >
                {status === 'loading' ? 'Enviando…' : buttonText}
              </button>
            </form>

            {showName ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                aria-label="Tu nombre"
                autoFocus
                style={{ borderColor: fieldBorder }}
                className={`field-on-primary mt-2 w-full border bg-transparent px-4 py-3 text-sm outline-none ${FOCUS_RING}`}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowName(true)}
                className={`mt-2 text-[13px] underline underline-offset-4 opacity-70 transition-opacity hover:opacity-100 ${FOCUS_RING}`}
              >
                Agregar mi nombre (opcional)
              </button>
            )}

            <p className="mt-3 text-[12px] opacity-60">
              Sin spam. Te escribimos solo cuando hay novedades o descuentos.
            </p>
          </div>
        )}

        {status === 'error' && (
          <p className="mt-3 text-sm text-red-300" role="alert">
            No pudimos suscribirte. Revisá el email y probá de nuevo.
          </p>
        )}
      </div>
    </section>
  );
}
