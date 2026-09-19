import { SectionHeader } from '@/components/SectionHeader';
import type { CustomSection, CustomSectionTableContent, CustomSectionVariant } from '@/lib/types';

/**
 * Tabla simple: medidas por talle, comparativa entre modelos. Todo texto plano
 * (nada de HTML en las celdas). La primera columna va resaltada porque casi
 * siempre es el talle o el nombre del modelo.
 *
 * Con muchas columnas scrollea en horizontal dentro de su caja en vez de
 * romper el ancho de la página en el celular.
 */
export function CustomTableSection({
  section,
  variant = 'default',
}: {
  section: CustomSection;
  variant?: CustomSectionVariant;
}) {
  const c = section.content as CustomSectionTableContent;
  const columns = (c.columns || []).map((h) => String(h ?? '').trim()).slice(0, 8);
  const rows = (c.rows || [])
    .filter((r) => Array.isArray(r) && r.some((cell) => String(cell ?? '').trim()))
    .slice(0, 30)
    .map((r) => r.slice(0, Math.max(columns.length, 1)).map((cell) => String(cell ?? '')));
  if (rows.length === 0) return null;
  const heading = (c.heading || '').trim();
  const subheading = (c.subheading || '').trim();
  const note = (c.note || '').trim();
  const inColumn = variant === 'column';
  const cell = inColumn ? 'px-2.5 py-2 text-[12.5px]' : 'px-4 py-3 text-[calc(13.5px_*_var(--font-scale,1))]';

  return (
    <section className={inColumn ? '' : 'px-6 py-8 md:py-14'}>
      <div className={inColumn ? '' : 'mx-auto max-w-3xl'}>
        {heading &&
          (inColumn ? (
            <div className="mb-3">
              <h2 className="text-[calc(15px_*_var(--font-scale,1))] font-semibold text-text">{heading}</h2>
              {subheading && <p className="mt-1 text-[calc(13px_*_var(--font-scale,1))] text-muted">{subheading}</p>}
            </div>
          ) : (
            <SectionHeader title={heading} subtitle={subheading || undefined} />
          ))}

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left">
            {columns.some(Boolean) && (
              <thead className="bg-line-soft">
                <tr>
                  {columns.map((h, i) => (
                    <th key={i} scope="col" className={`${cell} whitespace-nowrap font-semibold text-text`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-line-soft">
                  {r.map((v, ci) =>
                    ci === 0 ? (
                      <th key={ci} scope="row" className={`${cell} whitespace-nowrap font-semibold text-text`}>
                        {v}
                      </th>
                    ) : (
                      <td key={ci} className={`${cell} text-muted`}>
                        {v}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {note && <p className={`mt-2 text-muted ${inColumn ? 'text-[12px]' : 'text-[calc(12.5px_*_var(--font-scale,1))]'}`}>{note}</p>}
      </div>
    </section>
  );
}
