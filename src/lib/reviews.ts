import { supabase } from '@/lib/supabase';

/**
 * Reseñas verificadas de clientes (Extra PRO).
 *
 * El storefront nunca lee ni escribe la tabla `catalog_product_reviews`: lee por
 * RPC (sólo campos publicables) y escribe por la Edge Function
 * submit-product-review, que valida el link único de la venta. Ver
 * procurva2/supabase/migrations/20261001_customer_product_reviews.sql.
 *
 * Si la migración todavía no está aplicada, las RPC no existen: todo cae a
 * "sin reseñas" y la ficha sigue mostrando los testimonios del home.
 */

/** Reseña publicada de un producto. */
export interface VerifiedReview {
  id: string;
  customer_name: string;
  rating: number;
  text: string;
  photo_urls: string[];
  verified: boolean;
  created_at: string;
}

export interface RatingSummary {
  avg: number;
  count: number;
}

export async function fetchProductReviews(companyId: string, productId: string): Promise<VerifiedReview[]> {
  const { data, error } = await supabase.rpc('get_product_reviews', {
    p_company_id: companyId,
    p_product_id: productId,
    p_limit: 30,
  });
  if (error) {
    if (!/get_product_reviews/i.test(error.message)) {
      console.warn('[reviews] no se pudieron cargar las reseñas:', error.message);
    }
    return [];
  }
  return ((data ?? []) as VerifiedReview[]).map((r) => ({ ...r, photo_urls: r.photo_urls ?? [] }));
}

// Promedio por producto de toda la tienda: una sola consulta compartida por
// todas las cards de la página (y por la ficha). Se guarda por empresa.
const summaryCache = new Map<string, Promise<Map<string, RatingSummary>>>();

export function fetchRatingSummary(companyId: string): Promise<Map<string, RatingSummary>> {
  const cached = summaryCache.get(companyId);
  if (cached) return cached;
  const p = (async () => {
    const map = new Map<string, RatingSummary>();
    const { data, error } = await supabase.rpc('get_product_rating_summary', { p_company_id: companyId });
    if (error) {
      if (!/get_product_rating_summary/i.test(error.message)) {
        console.warn('[reviews] no se pudo cargar el promedio:', error.message);
      }
      return map;
    }
    for (const row of (data ?? []) as Array<{ product_id: string; rating_avg: number | string; rating_count: number }>) {
      map.set(row.product_id, { avg: Number(row.rating_avg), count: Number(row.rating_count) });
    }
    return map;
  })();
  summaryCache.set(companyId, p);
  return p;
}

// ── Página /resena/:token ────────────────────────────────────────────────────

export interface ReviewRequestItem {
  product_id: string;
  name: string;
  image_url: string | null;
  variant: string | null;
  reviewed: boolean;
}

export type ReviewRequestStatus = 'ok' | 'completed' | 'expired' | 'not_found' | 'unavailable' | 'error';

export interface ReviewRequestInfo {
  status: ReviewRequestStatus;
  customer_name?: string | null;
  customer_last_initial?: string | null;
  items?: ReviewRequestItem[];
}

export async function fetchReviewRequest(token: string, companyId: string): Promise<ReviewRequestInfo> {
  const { data, error } = await supabase.rpc('get_review_request', {
    p_token: token,
    p_company_id: companyId,
  });
  if (error) {
    console.warn('[reviews] no se pudo abrir el link:', error.message);
    return { status: 'error' };
  }
  return (data ?? { status: 'not_found' }) as ReviewRequestInfo;
}

export interface ReviewDraft {
  product_id: string;
  rating: number;
  text: string;
  /** Data URLs JPEG ya comprimidos (ver compressPhoto). */
  photos: string[];
}

export type SubmitResult =
  | { ok: true; published: number; pending: number }
  | { ok: false; error: string };

export async function submitReviews(input: {
  token: string;
  companyId: string;
  displayName: string;
  reviews: ReviewDraft[];
}): Promise<SubmitResult> {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  try {
    // fetch directo (no functions.invoke) para poder leer el mensaje del error.
    // Sin apikey/Authorization el gateway devuelve 401 (ver lib/orders.ts).
    const res = await fetch(`${baseUrl}/functions/v1/submit-product-review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        token: input.token,
        company_id: input.companyId,
        display_name: input.displayName,
        reviews: input.reviews,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok !== true) {
      return { ok: false, error: data?.error || 'No pudimos guardar tu opinión. Probá de nuevo en un momento.' };
    }
    return { ok: true, published: Number(data.published || 0), pending: Number(data.pending || 0) };
  } catch {
    return { ok: false, error: 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.' };
  }
}

const PHOTO_MAX_DIMENSION = 1280;
const PHOTO_QUALITY = 0.82;

/** Achica la foto a 1280px y la pasa a JPEG: una foto de celular pesa 4-8 MB. */
export function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo procesar la foto'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', PHOTO_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la foto'));
    };
    img.src = url;
  });
}
