import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

// detectSessionInUrl: false evita re-processamento de URL ao voltar de abas externas
// autoRefreshToken: true mantém sessão ativa mas sem disparar re-renders desnecessários
// storage: localStorage garante persistência da sessão
// storageKey: customizado para evitar conflitos
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: window.localStorage,
    storageKey: 'dkcwb-supabase-auth',
    // Desabilita o Web Lock exclusivo entre abas para evitar deadlocks observados em produção
    // Cast para any para satisfazer a tipagem do SDK nesta base.
    lock: false as unknown as any,
  },
});

// Log informativo para facilitar debug em caso de problemas relacionados a sessão/locks
if (typeof window !== 'undefined') {
  console.info('[supabase] client initialized — auth.lock is set to false to avoid cross-tab WebLock deadlocks');
}