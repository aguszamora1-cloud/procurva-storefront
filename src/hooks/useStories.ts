import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { Story } from '@/lib/types';

/** Stories activas del tenant, ordenadas por `order`. */
export function useStories(): { stories: Story[]; isLoading: boolean } {
  const { companyId } = useStoreStatus();
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('catalog_stories')
        .select('id, company_id, title, image_url, link_url, order, active')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('order', { ascending: true });
      if (cancelled) return;
      setStories((data as Story[]) ?? []);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { stories, isLoading };
}
