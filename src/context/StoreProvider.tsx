import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { resolveTenant } from '@/lib/tenant';
import { normalizeStoreConfig } from '@/lib/storeConfig';
import { applyDocumentMeta, applyTheme, loadFonts } from '@/lib/theme';
import type { CompanyRow, StoreConfig } from '@/lib/types';

type StoreStatus = 'loading' | 'ready' | 'not-found' | 'error';

interface StoreContextValue {
  config: StoreConfig | null;
  companyId: string | null;
  status: StoreStatus;
}

const StoreContext = createContext<StoreContextValue | null>(null);

// NOTA SEGURIDAD: NO incluir la columna `settings` — contiene secretos (claves
// AFIP, tokens Tiendanube) y anon ya no tiene acceso. El storefront no la usa.
const COMPANY_COLUMNS =
  'id, name, plan, catalog_enabled, catalog_slug, catalog_settings, catalog_shipping_message';

// Cache de config del tenant (stale-while-revalidate). Sirve la config cacheada
// para el primer paint instantáneo y SIEMPRE revalida en segundo plano, así una
// edición en el admin (texto de la franja promo, secciones, etc.) se refleja en
// el próximo reload en vez de quedar pegada hasta que venza un TTL.
// v4: invalida caches viejos (antes había un TTL de 5 min que evitaba revalidar
// dentro de la ventana; eso dejaba ediciones recientes sin verse). v3 sumó
// newsletter_popup; v2 fue el fix de normalización del plan.
const cacheKey = (slug: string) => `procurva_store_config_v4:${slug}`;

interface CacheEntry {
  ts: number;
  config: StoreConfig;
}

function readCache(slug: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed?.config || typeof parsed.ts !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(slug: string, config: StoreConfig): void {
  try {
    sessionStorage.setItem(cacheKey(slug), JSON.stringify({ ts: Date.now(), config }));
  } catch {
    /* sessionStorage lleno o no disponible: ignorar */
  }
}

/** Aplica tema, fuentes y meta de una config. */
function applyConfig(config: StoreConfig): void {
  applyTheme(config);
  loadFonts(config);
  applyDocumentMeta(config);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [status, setStatus] = useState<StoreStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    const tenant = resolveTenant();
    if (tenant.kind === 'generic') {
      setStatus('not-found');
      return;
    }
    const slug = tenant.slug.toLowerCase();

    // 1) Servir desde cache para el primer paint (stale-while-revalidate).
    const cached = readCache(slug);
    if (cached) {
      applyConfig(cached.config);
      setConfig(cached.config);
      setStatus('ready');
    }

    // 2) Revalidación contra Supabase. SIEMPRE corre: si había cache, el paint ya
    //    ocurrió y este fetch sólo refresca (sin bloquear ni parpadear, porque
    //    aplica los mismos valores cuando no cambió nada). Si no había cache, es
    //    la carga inicial. Revalidar siempre evita que una edición del admin quede
    //    "pegada" hasta vencer un TTL: el cambio aparece en el próximo reload.
    async function load() {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select(COMPANY_COLUMNS)
          .eq('catalog_slug', slug)
          .eq('catalog_enabled', true)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('[StoreProvider] error', error);
          // Si ya teníamos config cacheada, la mantenemos (no rompemos la tienda).
          if (!cached) setStatus('error');
          return;
        }
        if (!data) {
          setStatus('not-found');
          return;
        }

        const normalized = normalizeStoreConfig(data as unknown as CompanyRow);
        applyConfig(normalized);
        writeCache(slug, normalized);
        setConfig(normalized);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        console.error('[StoreProvider] unexpected', e);
        if (!cached) setStatus('error');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StoreContext.Provider
      value={{ config, companyId: config?.companyId ?? null, status }}
    >
      {children}
    </StoreContext.Provider>
  );
}

/** Config del tenant. Lanza si se usa fuera de una tienda cargada. */
export function useStore(): StoreConfig {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  if (!ctx.config) throw new Error('useStore: config not loaded yet');
  return ctx.config;
}

/** Estado de carga del provider (para gating en App). */
export function useStoreStatus(): { status: StoreStatus; companyId: string | null } {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStoreStatus must be used within StoreProvider');
  return { status: ctx.status, companyId: ctx.companyId };
}
