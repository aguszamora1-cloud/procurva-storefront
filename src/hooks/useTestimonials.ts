import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { Testimonial } from '@/lib/types';

/** Testimonios activos del tenant, ordenados por `order`. */
export function useTestimonials(): { testimonials: Testimonial[]; isLoading: boolean } {
  const { companyId } = useStoreStatus();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('catalog_testimonials')
        .select('id, company_id, customer_name, customer_photo_url, text, rating, order, active')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('order', { ascending: true });
      if (cancelled) return;
      setTestimonials((data as Testimonial[]) ?? []);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { testimonials, isLoading };
}
