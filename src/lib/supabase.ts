import { createClient } from '@supabase/supabase-js';

// Cliente anónimo de sólo lectura. Mismo patrón que `supabasePublic` en
// procurva2/components/PublicCatalog.tsx: sin persistencia de sesión, porque
// el storefront público nunca autentica un usuario final.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
