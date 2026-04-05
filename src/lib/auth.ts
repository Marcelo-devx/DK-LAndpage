import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

/**
 * Tenta obter a sessão com retry.
 *
 * No mobile, ao voltar de outra aba/app, o Supabase pode estar renovando
 * o token em background. Nesse intervalo, getSession() retorna null
 * temporariamente — o que causava redirecionamentos indevidos para /login.
 *
 * Esta função aguarda até `retries` tentativas com `delayMs` entre elas
 * antes de concluir que o usuário está realmente deslogado.
 */
export async function getSessionWithRetry(
  retries = 2,
  delayMs = 1500
): Promise<Session | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return session;
    } catch {
      // ignora erros de rede transitórios e tenta novamente
    }
    if (i < retries) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return null;
}
