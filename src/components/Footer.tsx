import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MessageCircle } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { instagramHref } from '@/lib/storeConfig';
import { whatsappLink } from '@/lib/utils';

// Íconos de medios de pago como texto/badges (sin assets externos).
const PAYMENT_LABELS: Record<string, string> = {
  mercadopago: 'MercadoPago',
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
};

export function Footer() {
  const config = useStore();
  const ig = instagramHref(config.instagramUrl);
  const wa = config.whatsapp ? whatsappLink(config.whatsapp, 'Hola! Quería hacer una consulta.') : '';
  const payments =
    config.paymentMethods.length > 0
      ? config.paymentMethods
      : ['mercadopago', 'transferencia', 'efectivo'];

  return (
    <footer className="mt-20 bg-primary text-[var(--color-on-primary)]">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 md:grid-cols-4">
        {/* Marca */}
        <div className="col-span-2 md:col-span-1">
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt={config.name}
              style={{ height: config.logoHeight }}
              className="mb-4 w-auto object-contain brightness-0 invert"
            />
          ) : (
            <p className="mb-4 font-heading text-lg font-extrabold uppercase">{config.name}</p>
          )}
          {config.footerText && (
            <p className="text-sm opacity-70">{config.footerText}</p>
          )}
          <div className="mt-4 flex items-center gap-3">
            {ig && (
              <a href={ig} target="_blank" rel="noreferrer" aria-label="Instagram" className="opacity-80 hover:opacity-100">
                <Instagram size={20} />
              </a>
            )}
            {config.facebookUrl && (
              <a href={config.facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook" className="opacity-80 hover:opacity-100">
                <Facebook size={20} />
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="opacity-80 hover:opacity-100">
                <MessageCircle size={20} />
              </a>
            )}
          </div>
        </div>

        {/* Tienda */}
        <div>
          <p className="subtitle-label mb-4 opacity-60">Tienda</p>
          <ul className="space-y-2 text-sm">
            <li><Link to="/productos" className="opacity-80 hover:opacity-100">Productos</Link></li>
            <li><Link to="/categorias" className="opacity-80 hover:opacity-100">Categorías</Link></li>
          </ul>
        </div>

        {/* Contacto */}
        <div>
          <p className="subtitle-label mb-4 opacity-60">Contacto</p>
          <ul className="space-y-2 text-sm">
            {wa && (
              <li>
                <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-2 opacity-80 hover:opacity-100">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              </li>
            )}
            {config.contactEmail && (
              <li>
                <a href={`mailto:${config.contactEmail}`} className="flex items-center gap-2 opacity-80 hover:opacity-100">
                  <Mail size={15} /> {config.contactEmail}
                </a>
              </li>
            )}
            {ig && (
              <li>
                <a href={ig} target="_blank" rel="noreferrer" className="flex items-center gap-2 opacity-80 hover:opacity-100">
                  <Instagram size={15} /> Instagram
                </a>
              </li>
            )}
          </ul>
        </div>

        {/* Pagos */}
        <div>
          <p className="subtitle-label mb-4 opacity-60">Medios de pago</p>
          <div className="flex flex-wrap gap-2">
            {payments.map((p) => (
              <span
                key={p}
                className="border border-[var(--color-on-primary)]/30 px-2 py-1 text-[0.7rem] uppercase tracking-wide opacity-80"
              >
                {PAYMENT_LABELS[p] ?? p}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--color-on-primary)]/15">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs opacity-70 md:flex-row">
          <span>© {new Date().getFullYear()} {config.name}</span>
          {config.showPoweredBy && (
            <a
              href="https://procurva.app"
              target="_blank"
              rel="noreferrer"
              className="hover:opacity-100"
            >
              Powered by ProCurva
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
