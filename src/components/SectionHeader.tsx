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

  // Sin titular no se pinta NADA del bloque de texto: si el comercio borró el
  // título desde el editor, la volanta ("Explorá", "Lo más buscado") queda
  // colgada arriba de la grilla y se lee como un sobrante, no como un
  // encabezado. Ver resolveSectionHeadings en lib/storeConfig.
  const hasTitle = Boolean(title && title.trim());

  const titleBlock = hasTitle ? (
    <div className={`w-full ${TEXT_ALIGN[align]}`}>
      {label && <p className="mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-accent">{label}</p>}
      <h2 className="font-heading text-[26px] font-semibold uppercase leading-[1.05] tracking-[1px] text-text md:text-[40px]">
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-3 max-w-xl text-[14px] text-muted md:text-[15px] ${SUBTITLE_ALIGN[align]}`}>{subtitle}</p>
      )}
    </div>
  ) : null;

  const link = linkTo ? (
    <Link
      to={linkTo}
      className="shrink-0 whitespace-nowrap text-[14px] font-medium text-muted transition-colors hover:text-accent"
    >
      {linkText ?? 'Ver todo'}
    </Link>
  ) : null;

  // Encabezado vacío por completo: ni siquiera el margen inferior, así la
  // sección arranca pegada a lo anterior en vez de dejar un hueco huérfano.
  if (!titleBlock && !link) return null;

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
