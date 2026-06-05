import { Link } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';

interface Props {
  label?: string;
  title: string;
  subtitle?: string;
  linkTo?: string;
  linkText?: string;
}

const TEXT_ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
const ITEMS_ALIGN = { left: 'items-start', center: 'items-center', right: 'items-end' } as const;
// El subtítulo tiene ancho máximo; lo centramos/derechamos con margen automático.
const SUBTITLE_ALIGN = { left: '', center: 'mx-auto', right: 'ml-auto' } as const;

export function SectionHeader({ label, title, subtitle, linkTo, linkText }: Props) {
  const { sectionTitleAlign: align } = useStore();

  const titleBlock = (
    <div className={`w-full ${TEXT_ALIGN[align]}`}>
      {label && <p className="mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-accent">{label}</p>}
      <h2 className="font-heading text-[26px] font-semibold uppercase leading-[1.05] tracking-[1px] text-text md:text-[40px]">
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-3 max-w-xl text-[14px] text-muted md:text-[15px] ${SUBTITLE_ALIGN[align]}`}>{subtitle}</p>
      )}
    </div>
  );

  const link = linkTo ? (
    <Link
      to={linkTo}
      className="shrink-0 whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.5px] text-muted transition-colors hover:text-accent"
    >
      {linkText ?? 'Ver todo'}
    </Link>
  ) : null;

  // Izquierda: título y link "Ver todo" en la misma fila (patrón clásico).
  if (align === 'left') {
    return (
      <div className="mb-8 flex items-end justify-between gap-4 md:mb-10">
        {titleBlock}
        {link}
      </div>
    );
  }

  // Centro / derecha: título alineado y el link debajo, respetando la alineación.
  return (
    <div className={`mb-8 flex flex-col gap-4 md:mb-10 ${ITEMS_ALIGN[align]}`}>
      {titleBlock}
      {link}
    </div>
  );
}
