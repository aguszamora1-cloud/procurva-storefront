import { useStore } from '@/context/StoreProvider';
import { whatsappLink } from '@/lib/utils';

/** Ícono oficial de WhatsApp (mismo path que usa el Footer). */
const WaIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.4 4.6A10 10 0 0 0 4.1 17.3L3 21l3.8-1.1A10 10 0 1 0 19.4 4.6Zm-7.4 15.3a8 8 0 0 1-4.1-1.1l-.3-.2-2.3.7.7-2.3-.2-.3a8 8 0 1 1 6.2 3.2Zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.3.2-.3.6-1 .1-.1 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4 0-.6.3l-.6.7a3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.7 2.6 4.2 3.6 1.5.6 2.1.7 2.9.5.5-.1 1.4-.6 1.6-1.2.2-.5.2-1 .2-1.1-.1-.1-.2-.1-.4-.2Z" />
  </svg>
);

/**
 * Botón flotante de WhatsApp, fijo abajo a la derecha en toda la tienda.
 * Usa el número configurado por el comercio (config.whatsapp). Si no hay número,
 * no se renderiza nada.
 */
export function FloatingWhatsApp() {
  const config = useStore();
  if (!config.whatsapp) return null;

  const href = whatsappLink(config.whatsapp, 'Hola! Quería hacer una consulta.');

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chatear por WhatsApp"
      title="Chatear por WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95"
    >
      <WaIcon />
    </a>
  );
}
