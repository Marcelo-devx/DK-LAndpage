import { supabase } from '@/integrations/supabase/client';

interface InvokeOptions {
  body?: Record<string, unknown>;
  maxAttempts?: number;   // padrão: 3
  baseDelayMs?: number;   // padrão: 1200ms
}

interface InvokeResult<T = unknown> {
  data: T | null;
  error: { message: string; context?: unknown } | null;
  attempts: number;
}

/**
 * Chama uma edge function com retry automático + backoff exponencial.
 *
 * Quando a função está em cold-start (shutdown → boot), o primeiro request
 * falha com FunctionsFetchError. Esta utilidade detecta esse tipo de erro
 * de rede e tenta novamente automaticamente, sem que o usuário perceba.
 *
 * Erros de negócio (status 4xx/5xx com JSON de erro) NÃO são retentados —
 * apenas falhas de conexão/fetch.
 */
export async function invokeWithRetry<T = unknown>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  const { body, maxAttempts = 3, baseDelayMs = 1200 } = options;

  let lastError: { message: string; context?: unknown } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke<T>(functionName, {
        body,
      });

      // Erro de rede/fetch (cold start, timeout, etc.) — retenta
      if (error && isFetchError(error)) {
        lastError = { message: error.message || 'FunctionsFetchError', context: error };
        console.warn(
          `[invokeWithRetry] ${functionName} tentativa ${attempt}/${maxAttempts} falhou (fetch error):`,
          error
        );

        if (attempt < maxAttempts) {
          const delay = baseDelayMs * attempt; // 1.2s, 2.4s, 3.6s
          await sleep(delay);
          continue;
        }

        return { data: null, error: lastError, attempts: attempt };
      }

      // Erro de negócio (ex: usuário não encontrado) — retorna imediatamente sem retry
      if (error) {
        return { data: null, error: { message: error.message || 'Erro desconhecido' }, attempts: attempt };
      }

      return { data, error: null, attempts: attempt };

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = { message: msg };
      console.warn(
        `[invokeWithRetry] ${functionName} tentativa ${attempt}/${maxAttempts} exception:`,
        err
      );

      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * attempt);
        continue;
      }
    }
  }

  return { data: null, error: lastError ?? { message: 'Erro desconhecido' }, attempts: maxAttempts };
}

// Detecta erros de conexão/fetch (cold start, rede, timeout)
function isFetchError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  const name = String(e.name || '');
  const msg = String(e.message || '').toLowerCase();
  return (
    name === 'FunctionsFetchError' ||
    (name === 'FunctionsHttpError' && msg.includes('fetch')) ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('fetch failed') ||
    msg.includes('load failed') ||
    msg.includes('network request failed') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
