/** Skeleton mientras carga la config del tenant. Neutro (sin tema todavía). */
export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white">
      <div className="h-14 border-b border-neutral-200" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 h-72 w-full animate-pulse bg-neutral-100" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[4/5] animate-pulse bg-neutral-100" />
              <div className="mt-3 h-3 w-3/4 animate-pulse bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
