// Banner de "vista previa" para el onboarding del admin (procurva2). El wizard
// embebe esta tienda en un iframe con ?preview=1 para mostrarle al usuario cómo
// se ve su storefront con el producto de ejemplo. Guardamos el flag en
// sessionStorage para que sobreviva a la navegación interna del SPA (los links
// internos no llevan el query param).
function isPreview(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === '1') {
      sessionStorage.setItem('pc_preview', '1');
      return true;
    }
    return sessionStorage.getItem('pc_preview') === '1';
  } catch {
    return false;
  }
}

export function PreviewBanner() {
  if (!isPreview()) return null;
  return (
    <div className="bg-accent/10 text-accent text-center text-[12px] font-medium px-4 py-2 leading-snug">
      Producto de ejemplo — así se verán tus productos reales cuando los cargues.
    </div>
  );
}
