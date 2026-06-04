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
  'id, name, plan, catalog_enabled, catalog_slug, catalog_settings, catalog_shipping_message, catalog_template_id';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [status, setStatus] = useState<StoreStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const tenant = resolveTenant();
      if (tenant.kind === 'generic') {
        if (!cancelled) setStatus('not-found');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('companies')
          .select(COMPANY_COLUMNS)
          .eq('catalog_slug', tenant.slug.toLowerCase())
          .eq('catalog_enabled', true)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('[StoreProvider] error', error);
          setStatus('error');
          return;
        }
        if (!data) {
          setStatus('not-found');
          return;
        }

        const normalized = normalizeStoreConfig(data as unknown as CompanyRow);
        applyTheme(normalized);
        loadFonts(normalized);
        applyDocumentMeta(normalized);
        setConfig(normalized);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        console.error('[StoreProvider] unexpected', e);
        setStatus('error');
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
