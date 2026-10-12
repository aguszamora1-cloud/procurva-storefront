// Banner de "vista previa" para el onboarding del admin (procurva2). El wizard
// embebe esta tienda en un iframe con ?preview=1 para mostrarle al usuario cómo
// se ve su storefront con el producto de ejemplo. Guardamos el flag en
// sessionStorage para que sobreviva a la navegación interna del SPA (los links
// internos no llevan el query param).
//
// La marca es PROPIA del onboarding. Antes era 'pc_preview', la misma que usa
// lib/previewMode para apagar la analítica en cualquier vista previa del ERP:
// el banner aparecía también en el diseñador y en el panel de la ficha
// (?pc_preview=1) apenas se navegaba. La analítica del onboarding la apaga
// previewMode, que también reconoce ?preview=1.
const ONBOARDING_KEY = 'pc_onboarding_preview';

function isPreview(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === '1') {
      sessionStorage.setItem(ONBOARDING_KEY, '1');
      return true;
    }
    return sessionStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function PreviewBanner() {
  if (!isPreview()) return null;
  return (
    <div className="bg-accent-a10 text-accent text-center text-[calc(12px_*_var(--font-scale,1))] font-medium px-4 py-2 leading-snug">
      Producto de ejemplo — así se verán tus productos reales cuando los cargues.
    </div>
  );
}
