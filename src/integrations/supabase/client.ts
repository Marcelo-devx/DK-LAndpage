import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

// lockNoOp: contorna o WebLock exclusivo entre abas
// O SDK só respeita isso se for uma FUNÇÃO truthy — false é ignorado
const lockNoOp = async <R,>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => fn();

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
    // ✅ Passa uma FUNÇÃO no-op (truthy) — o SDK entra no if (settings.lock)
    // e NÃO sobrescreve com navigatorLock
    lock: lockNoOp,
  },
});

// Log informativo para facilitar debug em caso de problemas relacionados a sessão/locks
if (typeof window !== 'undefined') {
  console.info('[supabase] client initialized — auth.lock is set to lockNoOp to avoid cross-tab WebLock deadlocks');
}