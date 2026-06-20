import { supabase } from './supabase';

export interface NewsletterResult {
  status: 'done' | 'duplicate' | 'error';
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
