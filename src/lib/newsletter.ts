import { supabase } from './supabase';
import { isConfirmedPreview } from './previewGuard';

export interface NewsletterResult {
  /** 'preview': vista previa del diseñador, no se suscribió a nadie (EDITOR E2.0b). */
  status: 'done' | 'duplicate' | 'error' | 'preview';
  /** Código de cupón único generado para este suscriptor (si la tienda lo tiene activado). */
  couponCode?: string;
}

/**
 * Suscribe un email al newsletter vía la edge function `newsletter-welcome`.
 * La función inserta el suscriptor, y si la tienda configuró el cupón de
 * bienvenida, genera un cupón único de un solo uso y se lo manda por email,
 * devolviéndolo acá para mostrarlo también en pantalla.
 *
 * El "ya estás suscripto" se detecta server-side (UNIQUE company_id+email) y
 * vuelve como status 'duplicate' (sin generar otro cupón).
 */
export async function subscribeNewsletter(
  companyId: string,
  email: string,
  name: string,
  source: 'popup' | 'section' | 'footer',
): Promise<NewsletterResult> {
  // EDITOR E2.0b: en la vista previa del diseñador no se inserta el suscriptor ni
  // se manda el mail de bienvenida (ni se genera su cupón).
  if (await isConfirmedPreview()) return { status: 'preview' };
  try {
    const { data, error } = await supabase.functions.invoke('newsletter-welcome', {
      body: { company_id: companyId, email, name: name || null, source },
    });
    if (error || !data?.ok) {
      console.error('[newsletter] error al suscribir', error || data);
      return { status: 'error' };
    }
    return {
      status: data.duplicate ? 'duplicate' : 'done',
      couponCode: typeof data.coupon_code === 'string' ? data.coupon_code : undefined,
    };
  } catch (err) {
    console.error('[newsletter] excepción al suscribir', err);
    return { status: 'error' };
  }
}
