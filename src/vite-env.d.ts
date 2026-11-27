/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_DEV_SLUG: string;
  /** Sólo desarrollo: origen del iframe de Turnstile del probador (ej. https://rosario.procurva.app). */
  readonly VITE_TRYON_FRAME_ORIGIN?: string;
  /** T6: '1' habilita las plantillas completas (lib/templateApp). Apagado por defecto. */
  readonly VITE_TEMPLATE_APPS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
