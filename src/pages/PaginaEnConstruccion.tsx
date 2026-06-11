/**
 * Pantalla que reemplaza al catálogo cuando el comercio desactivó esta tienda
 * (toggle "página en construcción" del admin → companies.storefront_<tipo>_active).
 * No usa la config del tenant (no se carga el tema cuando la tienda está
 * desactivada): paleta neutra propia con soporte de dark mode por preferencia
 * del sistema (Tailwind darkMode 'media').
 */
export function PaginaEnConstruccion({ nombreEmpresa }: { nombreEmpresa?: string | null }) {
  const nombre = nombreEmpresa?.trim() || 'esta tienda';

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-5 text-5xl" role="img" aria-label="En construcción">
          🚧
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50">
          Página en construcción
        </h1>
        <p className="mt-3 text-neutral-500 dark:text-neutral-400">
          La tienda de {nombre} no está disponible en este momento. Volvé a
          intentar más tarde.
        </p>
        <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-600">
          Powered by ProCurva
        </p>
      </div>
    </div>
  );
}
