// Validación de teléfono del checkout.
//
// Por qué existe: el formulario sólo chequeaba "no vacío". Si el autocompletado
// del navegador volcaba el email en el campo teléfono (pasa cuando los inputs no
// declaran name/type/autocomplete, y el heurístico de Safari/iOS decide solo),
// el pedido se guardaba con el email como teléfono y el comercio se quedaba sin
// forma de contactar al cliente por WhatsApp.

/** Sólo los dígitos del texto. */
export const phoneDigits = (raw: string): string => (raw || '').replace(/\D/g, '');

/**
 * True si el texto parece un teléfono real. Pide 8 dígitos como mínimo (un fijo
 * argentino sin característica ya tiene 8) y rechaza cualquier cosa que tenga
 * "@", que es la firma exacta del email autocompletado en el campo equivocado.
 */
export const looksLikePhone = (raw: string): boolean => {
  const v = (raw || '').trim();
  if (!v || v.includes('@')) return false;
  const digits = phoneDigits(v);
  return digits.length >= 8 && digits.length <= 15;
};
