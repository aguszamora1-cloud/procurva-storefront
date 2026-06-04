import { Link } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { Seo } from '@/components/Seo';

/**
 * 404 de una ruta interna inexistente DENTRO de una tienda válida
 * (ej: /pagina-que-no-existe). Usa el tema del tenant. noindex.
 */
export function RouteNotFound() {
  const config = useStore();
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center md:py-32">
      <Seo title={`Página no encontrada · ${config.name}`} slug={config.slug} noindex />
      <p className="font-heading text-[64px] font-extrabold leading-none text-accent md:text-[88px]">404</p>
      <h1 className="mt-4 font-heading text-[26px] font-bold uppercase tracking-tight text-text md:text-[32px]">
        Página no encontrada
      </h1>
      <p className="mt-3 max-w-md text-[15px] text-muted">
        La página que buscás no existe o fue movida.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="rounded-[10px] bg-primary px-8 py-3.5 text-[14px] font-bold uppercase tracking-[0.5px] text-on-primary transition-all hover:bg-accent hover:text-on-accent"
        >
          Volver al inicio
        </Link>
        <Link to="/productos" className="text-[13px] uppercase tracking-wide text-subtle hover:text-accent">
          Ver productos
        </Link>
      </div>
    </div>
  );
}
