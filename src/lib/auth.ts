import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Tenta obter a sessão com retry.
 *
 * No mobile/desktop, ao voltar de outra aba/app, o Supabase pode estar renovando
 * o token em background. Nesse intervalo, getSession() retorna null
 * temporariamente — o que causava redirecionamentos indevidos para /login.
 *
 * Esta função aguarda até `retries` tentativas com `delayMs` entre elas
 * antes de concluir que o usuário está realmente deslogado.
 *
 * Reduzimos o delay para 800ms para reduzir o tempo de espera visual.
 */
export async function getSessionWithRetry(
  retries = 2,
  delayMs = 800
): Promise<Session | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return session;
    } catch (e) {
      // ignora erros de rede transitórios e tenta novamente
      console.warn('[auth] getSession attempt failed:', e);
    }
    if (i < retries) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return null;
}

/**
 * Tenta obter a sessão, e se falhar, tenta obter o usuário.
 * O getUser força um refresh do token, o que pode ajudar em casos onde
 * getSession retorna null mas o token ainda é válido.
 */
export async function getSessionOrUser(): Promise<{ session: Session | null; user: User | null }> {
  try {
    // Primeiro tenta getSession (mais rápido, usa cache)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      return { session, user: session.user };
    }
  } catch (e) {
    console.warn('[auth] getSession failed, trying getUser:', e);
  }

  // Se getSession falhar ou retornar null, tenta getUser (força refresh)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return { session: null, user };
  } catch (e) {
    console.warn('[auth] getUser also failed:', e);
    return { session: null, user: null };
  }
}

/**
 * Helper para verificar se existe uma sessão válida.
 * Usa getSessionOrUser internamente para maior robustez.
 */
export async function hasValidSession(): Promise<boolean> {
  const { session } = await getSessionOrUser();
  return session !== null;
}