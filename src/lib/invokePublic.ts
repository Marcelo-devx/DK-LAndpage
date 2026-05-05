/**
 * Chama uma edge function pública via fetch direto.
 *
 * Envia o anon key no header `apikey` (obrigatório pelo gateway do Supabase)
 * e também como `Authorization: Bearer` para compatibilidade.
 *
 * NOTA: Se a função tiver verify_jwt=true no Dashboard do Supabase,
 * o gateway vai rejeitar com 401 porque o anon key não tem `sub`.
 * Nesse caso, a solução é desabilitar "Enforce JWT Verification" no
 * Dashboard: Project → Edge Functions → [função] → desabilitar o toggle.
 */

import { supabase } from '@/integrations/supabase/client';

interface PublicInvokeOptions {
  body?: Record<string, unknown>;
  maxAttempts?: number;
  baseDelayMs?: number;
}

interface InvokeResult<T = unknown> {
  data: T | null;
  error: { message: string; context?: unknown } | null;
  attempts: number;
}

export async function invokePublic<T = unknown>(
  functionName: string,
  options: PublicInvokeOptions = {}
): Promise<InvokeResult<T>> {
  const { body, maxAttempts = 3, baseDelayMs = 1500 } = options;

  let lastError: { message: string; context?: unknown } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke<T>(functionName, {
        body,
      });

      if (error) {
        const msg = (error as any)?.message || String(error);
        lastError = { message: msg, context: error };

        // Erros de rede/cold start — retenta
        const isRetryable =
          msg.toLowerCase().includes('fetch') ||
          msg.toLowerCase().includes('network') ||
          msg.toLowerCase().includes('timeout') ||
          msg.toLowerCase().includes('failed to fetch') ||
          (error as any)?.name === 'FunctionsFetchError';

        if (isRetryable && attempt < maxAttempts) {
          await sleep(baseDelayMs * attempt);
          continue;
        }

        return { data: null, error: lastError, attempts: attempt };
      }

      return { data, error: null, attempts: attempt };

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = { message: msg };
      console.warn(`[invokePublic] ${functionName} tentativa ${attempt}/${maxAttempts} falhou:`, msg);

      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * attempt);
        continue;
      }
    }
  }

  return { data: null, error: lastError ?? { message: "Erro desconhecido" }, attempts: maxAttempts };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
