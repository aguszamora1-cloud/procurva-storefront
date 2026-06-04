import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applySeo, type SeoInput } from '@/lib/seo';

/**
 * Aplica los meta tags de SEO de la página. Se re-ejecuta cuando cambian los
 * datos o la ruta. No renderiza nada.
 */
export function Seo(props: Omit<SeoInput, 'path'> & { path?: string }) {
  const { pathname } = useLocation();
  const {
    title,
    description,
    image,
    type,
    slug,
    siteName,
    noindex,
    path,
  } = props;

  useEffect(() => {
    applySeo({ title, description, image, type, slug, siteName, noindex, path: path ?? pathname });
  }, [title, description, image, type, slug, siteName, noindex, path, pathname]);

  return null;
}
