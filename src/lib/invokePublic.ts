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
        body: body ?? {},
      });

      if (error) {
        const msg = error.message || `Erro ao chamar ${functionName}`;
        lastError = { message: msg, context: error };
        console.warn(`[invokePublic] ${functionName} tentativa ${attempt}/${maxAttempts} erro:`, msg);

        if (attempt < maxAttempts) {
          await sleep(baseDelayMs * attempt);
          continue;
        }

        return { data: null, error: lastError, attempts: attempt };
      }

      return { data, error: null, attempts: attempt };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = { message: msg };
      console.warn(`[invokePublic] ${functionName} tentativa ${attempt}/${maxAttempts} exceção:`, msg);
    }

    if (attempt < maxAttempts) {
      await sleep(baseDelayMs * attempt);
    }
  }

  return {
    data: null,
    error: lastError ?? { message: 'Erro desconhecido' },
    attempts: maxAttempts,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
