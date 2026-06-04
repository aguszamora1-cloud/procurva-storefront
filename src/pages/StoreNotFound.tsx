/**
 * Página genérica cuando el slug no resuelve a una tienda (host genérico,
 * slug inexistente o catálogo deshabilitado). NO usa la config del tenant
 * (no hay) — branding de ProCurva.
 */
export function StoreNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center text-neutral-900">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-md bg-neutral-900">
        <span className="text-xl font-extrabold text-white">P</span>
      </div>
      <h1 className="text-2xl font-extrabold uppercase tracking-tight md:text-3xl">
        Tienda no encontrada
      </h1>
      <p className="mt-3 max-w-md text-neutral-500">
        Esta tienda no existe o no está disponible.
      </p>
      <a
        href="https://procurva.app"
        className="mt-8 inline-flex items-center gap-2 bg-neutral-900 px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
      >
        ¿Querés tu propia tienda? → ProCurva
      </a>
      <p className="mt-10 text-xs text-neutral-400">Powered by ProCurva</p>
    </div>
  );
}
