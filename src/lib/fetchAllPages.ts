// PostgREST devuelve como máximo 1000 filas por consulta y el resto se pierde en
// silencio. Recorre todas las páginas: `build(from, to)` arma la consulta completa
// y le aplica el .range(from, to).
const PAGE = 1000;

export async function fetchAllPages<T = unknown>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  maxRows = 100_000,
): Promise<{ data: T[] | null; error: unknown }> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { data: rows.length ? rows : null, error };
    rows.push(...((data as T[]) ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { data: rows, error: null };
}
