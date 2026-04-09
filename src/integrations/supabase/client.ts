import { createClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

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
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
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
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.info('[supabase] client initialized — auth.lock is set to lockNoOp to avoid cross-tab WebLock deadlocks');
}