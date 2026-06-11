/**
 * Pantalla de error a nivel app (Supabase caído al cargar la config, o crash
 * capturado por el ErrorBoundary). Neutra: NO depende del tema del tenant
 * porque puede que la config nunca haya cargado. Branding de ProCurva.
 */
export function ErrorScreen({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center text-neutral-900">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-md bg-neutral-900">
        <span className="text-xl font-extrabold text-white">P</span>
      </div>
      <h1 className="text-2xl font-extrabold uppercase tracking-tight md:text-3xl">
        Algo salió mal
      </h1>
      <p className="mt-3 max-w-md text-neutral-500">
        No pudimos cargar la tienda en este momento. Probá de nuevo en unos segundos.
      </p>
      <button
        type="button"
        onClick={onRetry ?? (() => window.location.reload())}
        className="mt-8 bg-neutral-900 px-8 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        Reintentar
      </button>
      <p className="mt-10 text-xs text-neutral-400">Powered by ProCurva</p>
    </div>
  );
}

/**
 * Estado de error inline (themed) para fallas de datos dentro de una tienda ya
 * cargada — p. ej. la grilla de productos no pudo traer datos.
 */
export function InlineError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-[15px] font-semibold text-text">No pudimos cargar el contenido</p>
      {message && <p className="max-w-md text-[13px] text-subtle">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-[10px] bg-primary px-7 py-3 text-[13px] font-bold text-on-primary transition-all hover:bg-accent hover:text-on-accent"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
