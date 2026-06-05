import { Link } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { instagramHref } from '@/lib/storeConfig';
import { whatsappLink } from '@/lib/utils';

const PAYMENT_LABELS: Record<string, string> = {
  mercadopago: 'MercadoPago',
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
};

const IgIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
  </svg>
);
const WaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.4 4.6A10 10 0 0 0 4.1 17.3L3 21l3.8-1.1A10 10 0 1 0 19.4 4.6Zm-7.4 15.3a8 8 0 0 1-4.1-1.1l-.3-.2-2.3.7.7-2.3-.2-.3a8 8 0 1 1 6.2 3.2Zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.3.2-.3.6-1 .1-.1 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4 0-.6.3l-.6.7a3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.7 2.6 4.2 3.6 1.5.6 2.1.7 2.9.5.5-.1 1.4-.6 1.6-1.2.2-.5.2-1 .2-1.1-.1-.1-.2-.1-.4-.2Z" />
  </svg>
);
const FbIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H9v3h2v7h3v-7h2.5l.5-3H14V9c0-.6.4-1 1-1Z" />
  </svg>
);

function SocialCircle({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-on-primary)]/20 text-[var(--color-on-primary)]/80 transition-colors hover:border-accent hover:bg-accent hover:text-on-accent"
    >
      {children}
    </a>
  );
}

export function Footer() {
  const config = useStore();
  const ig = instagramHref(config.instagramUrl);
  const wa = config.whatsapp ? whatsappLink(config.whatsapp, 'Hola! Quería hacer una consulta.') : '';
  const payments =
    config.paymentMethods.length > 0 ? config.paymentMethods : ['mercadopago', 'visa', 'mastercard', 'transferencia', 'efectivo'];

  return (
    <footer className="bg-primary text-[var(--color-on-primary)]">
      <div className="mx-auto grid max-w-none grid-cols-2 gap-10 px-6 py-14 md:grid-cols-4">
        {/* Marca */}
        <div className="col-span-2 md:col-span-1">
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt={config.name}
              style={{ height: config.logoHeight }}
              className="w-auto object-contain brightness-0 invert"
            />
          ) : (
            <p className="font-heading text-[22px] font-extrabold uppercase tracking-[-0.5px]">{config.name}</p>
          )}
          {config.footerText && (
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-on-primary)]/60">{config.footerText}</p>
          )}
          <div className="mt-5 flex items-center gap-3">
            {ig && <SocialCircle href={ig} label="Instagram"><IgIcon /></SocialCircle>}
            {config.facebookUrl && <SocialCircle href={config.facebookUrl} label="Facebook"><FbIcon /></SocialCircle>}
            {wa && <SocialCircle href={wa} label="WhatsApp"><WaIcon /></SocialCircle>}
          </div>
        </div>

        {/* Tienda */}
        <div>
          <p className="mb-4 text-[11px] font-semibold tracking-[1px] text-[var(--color-on-primary)]/50">TIENDA</p>
          <ul className="space-y-2.5 text-[14px]">
            <li><Link to="/productos" className="text-[var(--color-on-primary)]/85 transition-colors hover:text-accent">Productos</Link></li>
            <li><Link to="/categorias" className="text-[var(--color-on-primary)]/85 transition-colors hover:text-accent">Categorías</Link></li>
            <li><Link to="/carrito" className="text-[var(--color-on-primary)]/85 transition-colors hover:text-accent">Carrito</Link></li>
          </ul>
        </div>

        {/* Contacto */}
        <div>
          <p className="mb-4 text-[11px] font-semibold tracking-[1px] text-[var(--color-on-primary)]/50">CONTACTO</p>
          <ul className="space-y-2.5 text-[14px]">
            {wa && <li><a href={wa} target="_blank" rel="noreferrer" className="text-[var(--color-on-primary)]/85 transition-colors hover:text-accent">WhatsApp</a></li>}
            {ig && <li><a href={ig} target="_blank" rel="noreferrer" className="text-[var(--color-on-primary)]/85 transition-colors hover:text-accent">Instagram</a></li>}
            {config.contactEmail && <li><a href={`mailto:${config.contactEmail}`} className="text-[var(--color-on-primary)]/85 transition-colors hover:text-accent">{config.contactEmail}</a></li>}
          </ul>
        </div>
      </div>

      {/* Métodos de pago */}
      <div className="border-t border-[var(--color-on-primary)]/10">
        <div className="mx-auto flex max-w-none flex-wrap items-center justify-between gap-4 px-6 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[var(--color-on-primary)]/50">Aceptamos</p>
          <div className="flex flex-wrap items-center gap-2">
            {payments.map((p) => (
              <span
                key={p}
                className="inline-flex items-center rounded border border-[var(--color-on-primary)]/15 bg-[var(--color-on-primary)]/[0.04] px-2.5 py-1 text-[11px] tracking-wide text-[var(--color-on-primary)]/85"
              >
                {PAYMENT_LABELS[p] ?? p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[var(--color-on-primary)]/10">
        <div className="mx-auto flex max-w-none flex-wrap justify-between gap-2 px-6 py-5 text-[11px] tracking-[0.5px] text-[var(--color-on-primary)]/50">
          <span>© {new Date().getFullYear()} {config.name.toUpperCase()}</span>
          {config.showPoweredBy && (
            <a href="https://procurva.app" target="_blank" rel="noreferrer" className="transition-colors hover:text-accent">
              POWERED BY PROCURVA
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
