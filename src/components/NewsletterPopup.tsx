import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/context/StoreProvider';
import { supabase } from '@/lib/supabase';

/** ¿El color es claro? (para elegir color de texto legible encima). */
function isLight(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

const readFlag = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeFlag = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* localStorage no disponible */
  }
};

/**
 * Popup de captura de email (Extra PRO). Aparece tras un delay configurable,
 * inserta en catalog_newsletter_subscribers con source 'popup' y respeta
 * "mostrar solo 1 vez" vía localStorage. En mobile, no irrumpe mientras el
 * usuario está scrolleando: espera a que el scroll se detenga.
 */
export function NewsletterPopup() {
  const config = useStore();
  const popup = config.newsletterPopup;
  const storageKey = `procurva_nl_popup:${config.companyId}`;

  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'duplicate' | 'error'>('idle');
  const shownRef = useRef(false);

  const active = config.isPro && popup.enabled;

  // Timing de aparición (delay + anti-scroll en mobile).
  useEffect(() => {
    if (!active) return;
    const flag = readFlag(storageKey);
    if (flag === 'subscribed') return; // ya suscripto en este dispositivo
    if (flag === 'dismissed' && popup.once) return; // ya cerrado y "solo 1 vez"

    let scrolling = false;
    let scrollIdle: number | undefined;
    let armed = false;

    const reveal = () => {
      if (shownRef.current) return;
      shownRef.current = true;
      setVisible(true);
    };
    const attempt = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      if (!isMobile || !scrolling) reveal();
    };
    const onScroll = () => {
      scrolling = true;
      window.clearTimeout(scrollIdle);
      scrollIdle = window.setTimeout(() => {
        scrolling = false;
        if (armed) reveal();
      }, 600);
    };

    const delayTimer = window.setTimeout(() => {
      armed = true;
      attempt();
    }, Math.max(0, popup.delaySeconds) * 1000);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.clearTimeout(delayTimer);
      window.clearTimeout(scrollIdle);
      window.removeEventListener('scroll', onScroll);
    };
  }, [active, popup.delaySeconds, popup.once, storageKey]);

  // Animación de entrada (fade + scale).
  useEffect(() => {
    if (!visible) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [visible]);

  if (!active || !visible) return null;

  const close = () => {
    if (popup.once) writeFlag(storageKey, 'dismissed');
    setVisible(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !config.companyId) return;
    setStatus('loading');
    const { error } = await supabase.from('catalog_newsletter_subscribers').insert({
      company_id: config.companyId,
      email: email.trim().toLowerCase(),
      name: popup.askName ? name.trim() || null : null,
      source: 'popup',
    });
    if (error) {
      if (error.code === '23505') {
        writeFlag(storageKey, 'subscribed');
        setStatus('duplicate');
        window.setTimeout(() => setVisible(false), 2000);
      } else {
        console.error('Error al suscribir (popup):', error);
        setStatus('error');
      }
      return;
    }
    writeFlag(storageKey, 'subscribed');
    setStatus('done');
    window.setTimeout(() => setVisible(false), 2000);
  };

  const textColor = isLight(popup.bgColor) ? '#111111' : '#ffffff';
  const btnTextColor = isLight(popup.buttonColor) ? '#111111' : '#ffffff';
  const finished = status === 'done' || status === 'duplicate';

  return (
    <div
      className={`fixed inset-0 z-[1100] flex items-center justify-center p-4 transition-opacity duration-200 ${
        entered ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: popup.bgColor, color: textColor }}
        className={`relative w-full max-w-sm rounded-lg p-7 shadow-2xl transition-all duration-200 md:max-w-md ${
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-current opacity-60 transition-opacity hover:opacity-100"
          style={{ color: textColor }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>

        {finished ? (
          <div className="py-8 text-center">
            <p className="text-lg font-bold">{status === 'duplicate' ? 'Ya estás suscripto 🙌' : popup.successMessage}</p>
          </div>
        ) : (
          <>
            <h2 className="pr-6 text-xl font-extrabold uppercase leading-tight tracking-tight md:text-2xl">{popup.title}</h2>
            {popup.subtitle && <p className="mt-1.5 text-sm opacity-70">{popup.subtitle}</p>}

            <form className="mt-5 space-y-3" onSubmit={submit}>
              {popup.askName && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  style={{ borderColor: textColor + '40', color: textColor }}
                  className="w-full rounded-md border bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-50 focus:border-current"
                />
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Tu email"
                style={{ borderColor: textColor + '40', color: textColor }}
                className="w-full rounded-md border bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-50 focus:border-current"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{ backgroundColor: popup.buttonColor, color: btnTextColor }}
                className="w-full rounded-md px-5 py-3 text-sm font-bold transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                {status === 'loading' ? 'Enviando…' : popup.buttonText}
              </button>
            </form>

            {status === 'error' && <p className="mt-2 text-center text-xs text-red-500">Hubo un error. Probá de nuevo.</p>}
            {popup.footerText && <p className="mt-3 text-center text-[11px] opacity-50">{popup.footerText}</p>}
          </>
        )}
      </div>
    </div>
  );
}
