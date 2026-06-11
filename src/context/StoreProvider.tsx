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
import type { ResolvedStorefront, StoreConfig, StoreType } from '@/lib/types';

type StoreStatus =
  | 'loading'
  | 'ready'
  | 'not-found'
  | 'error'
  | 'needs-password'
  | 'under-construction';

/**
 * Branding mínimo para pintar el gate de la tienda mayorista protegida y la
 * página "en construcción" (ambos necesitan solo nombre + logo, sin catálogo).
 */
interface PendingStore {
  name: string;
  logoUrl: string;
  /** Mensaje personalizado para la página "en construcción" (solo ese caso). */
  message?: string | null;
}

interface StoreContextValue {
  config: StoreConfig | null;
  companyId: string | null;
  status: StoreStatus;
  storeType: StoreType | null;
  requiresPassword: boolean;
  slug: string | null;
  // Datos para el gate (nombre + logo) cuando status === 'needs-password'.
  pendingStore: PendingStore | null;
  // El gate lo llama con el payload de verify_storefront_password tras un código OK.
  unlock: (resolved: ResolvedStorefront) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

// Cache de config del tenant (stale-while-revalidate). Sirve la config cacheada
// para el primer paint instantáneo y SIEMPRE revalida en segundo plano, así una
// edición en el admin (texto de la franja promo, secciones, etc.) se refleja en
// el próximo reload en vez de quedar pegada hasta que venza un TTL.
// v5: la resolución pasó a la RPC get_storefront_by_slug (dual store), la entrada
// ahora guarda storeType/requiresPassword. v4 invalidó el TTL viejo; v3 sumó
// newsletter_popup; v2 fue el fix de normalización del plan.
const cacheKey = (slug: string) => `procurva_store_config_v5:${slug}`;
// Flag por sesión: la tienda mayorista protegida ya fue desbloqueada con el código.
const unlockKey = (slug: string) => `procurva_wholesale_unlock:${slug}`;

interface CacheEntry {
  ts: number;
  config: StoreConfig;
  storeType: StoreType;
  requiresPassword: boolean;
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

function writeCache(slug: string, entry: Omit<CacheEntry, 'ts'>): void {
  try {
    sessionStorage.setItem(cacheKey(slug), JSON.stringify({ ts: Date.now(), ...entry }));
  } catch {
    /* sessionStorage lleno o no disponible: ignorar */
  }
}

function isUnlocked(slug: string): boolean {
  try {
    return sessionStorage.getItem(unlockKey(slug)) === '1';
  } catch {
    return false;
  }
}

function markUnlocked(slug: string): void {
  try {
    sessionStorage.setItem(unlockKey(slug), '1');
  } catch {
    /* ignorar */
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
  const [storeType, setStoreType] = useState<StoreType | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [pendingStore, setPendingStore] = useState<PendingStore | null>(null);

  /** Normaliza un payload resuelto y lo aplica como config activa. */
  function applyResolved(currentSlug: string, resolved: ResolvedStorefront): void {
    const normalized = normalizeStoreConfig(resolved);
    applyConfig(normalized);
    writeCache(currentSlug, {
      config: normalized,
      storeType: resolved.store_type,
      requiresPassword: resolved.requires_password,
    });
    setConfig(normalized);
    setStoreType(resolved.store_type);
    setRequiresPassword(resolved.requires_password);
    setStatus('ready');
  }

  // El gate llama esto tras un código correcto (payload de verify_storefront_password).
  function unlock(resolved: ResolvedStorefront): void {
    const currentSlug = (resolved.slug || slug || '').toLowerCase();
    if (currentSlug) markUnlocked(currentSlug);
    setPendingStore(null);
    applyResolved(currentSlug, resolved);
  }

  useEffect(() => {
    let cancelled = false;

    const tenant = resolveTenant();
    if (tenant.kind === 'generic') {
      setStatus('not-found');
      return;
    }
    const currentSlug = tenant.slug.toLowerCase();
    setSlug(currentSlug);

    // 1) Servir desde cache para el primer paint (stale-while-revalidate).
    const cached = readCache(currentSlug);
    if (cached) {
      applyConfig(cached.config);
      setConfig(cached.config);
      setStoreType(cached.storeType);
      setRequiresPassword(cached.requiresPassword);
      setStatus('ready');
    }

    // 2) Revalidación contra Supabase vía RPC. SIEMPRE corre.
    async function load() {
      try {
        const { data, error } = await supabase.rpc('get_storefront_by_slug', {
          p_slug: currentSlug,
        });

        if (cancelled) return;

        if (error) {
          console.error('[StoreProvider] error', error);
          // Si ya teníamos config cacheada, la mantenemos (no rompemos la tienda).
          if (!cached) setStatus('error');
          return;
        }

        const resolved = data as ResolvedStorefront | null;
        if (!resolved || !resolved.company_id) {
          setStatus('not-found');
          return;
        }

        setStoreType(resolved.store_type);
        setRequiresPassword(resolved.requires_password);

        // Página en construcción: el comercio desactivó esta tienda (toggle del
        // admin). Tiene prioridad sobre el gate de password — si está en
        // construcción no pedimos código. Invalidamos la cache para que un
        // visitante recurrente no vea el catálogo viejo por un instante.
        if (resolved.active === false) {
          try {
            sessionStorage.removeItem(cacheKey(currentSlug));
          } catch {
            /* ignorar */
          }
          setPendingStore({
            name: resolved.name ?? 'Tienda',
            logoUrl: resolved.logo_url ?? '',
            message: resolved.message ?? null,
          });
          setConfig(null);
          setStatus('under-construction');
          return;
        }

        // Tienda mayorista protegida: requiere código.
        if (resolved.requires_password) {
          // Ya desbloqueada en esta sesión y con config buena (cache): mantenerla.
          if (isUnlocked(currentSlug) && (cached || config)) {
            setStatus('ready');
            return;
          }
          // Mostrar el gate con el branding mínimo que trae el payload.
          setPendingStore({
            name: resolved.name ?? 'Tienda',
            logoUrl: resolved.logo_url ?? '',
          });
          setConfig(null);
          setStatus('needs-password');
          return;
        }

        // Tienda pública (minorista o mayorista pública): aplicar config completa.
        applyResolved(currentSlug, resolved);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StoreContext.Provider
      value={{
        config,
        companyId: config?.companyId ?? null,
        status,
        storeType,
        requiresPassword,
        slug,
        pendingStore,
        unlock,
      }}
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
export function useStoreStatus(): {
  status: StoreStatus;
  companyId: string | null;
  storeType: StoreType | null;
  requiresPassword: boolean;
  slug: string | null;
  pendingStore: PendingStore | null;
  unlock: (resolved: ResolvedStorefront) => void;
} {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStoreStatus must be used within StoreProvider');
  return {
    status: ctx.status,
    companyId: ctx.companyId,
    storeType: ctx.storeType,
    requiresPassword: ctx.requiresPassword,
    slug: ctx.slug,
    pendingStore: ctx.pendingStore,
    unlock: ctx.unlock,
  };
}

/** Tipo de tienda resuelta (seam para el render mayorista). */
export function useStoreType(): StoreType | null {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStoreType must be used within StoreProvider');
  return ctx.storeType;
}
