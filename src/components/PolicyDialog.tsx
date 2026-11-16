import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  title: string;
  text: string;
  onClose: () => void;
}

/**
 * Diálogo de lectura de una política (abierto desde «Información» del footer).
 *
 * Accesible: role="dialog" + aria-modal + aria-labelledby, foco al botón Cerrar
 * al abrir y de vuelta al enlace al cerrar, Escape y click en el fondo cierran,
 * Tab queda adentro. Bloquea el scroll del body como CartDrawer/ImageLightbox.
 * Va por portal a <body> para no depender de transforms/overflow de ancestros.
 *
 * Colores y esquinas salen de los tokens del tenant (bg-background,
 * text-on-surface, rounded-lg): toma la estética de cada tienda sola.
 */
export function PolicyDialog({ title, text, onClose }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // onClose en ref: si el padre re-renderiza (llega config nueva), el efecto NO se
  // vuelve a correr y el foco no salta.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>('button, [tabindex="0"]');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85dvh] w-full flex-col rounded-t-lg bg-background text-on-surface shadow-2xl sm:max-w-lg sm:rounded-lg"
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id={titleId} className="font-heading text-[calc(16px_*_var(--font-scale,1))] font-bold">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-muted transition-colors hover:text-on-surface"
          >
            <X size={20} strokeWidth={1.8} />
          </button>
        </div>
        <div tabIndex={0} className="overflow-y-auto px-5 py-4 outline-none">
          <p className="whitespace-pre-line text-[calc(14px_*_var(--font-scale,1))] leading-relaxed text-on-surface-muted">{text}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
