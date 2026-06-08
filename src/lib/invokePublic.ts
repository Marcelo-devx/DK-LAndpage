// Usa raw fetch com apikey + Authorization explícitos para garantir que o gateway
// do Supabase aceite a requisição mesmo quando verify_jwt não esteja configurado
// corretamente no deploy.
const SUPABASE_URL = 'https://jrlozhhvwqfmjtkmvukf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM';

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
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  let lastError: { message: string; context?: unknown } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        let errData: unknown = null;
        try { errData = await res.json(); } catch { try { errData = await res.text(); } catch { errData = null; } }

        const msg =
          typeof errData === 'object' && errData !== null && 'error' in errData
            ? String((errData as any).error)
            : typeof errData === 'string' && errData.trim()
              ? errData
              : `HTTP ${res.status}`;

        lastError = { message: msg, context: errData };

        // 401 pode ser falha temporária do gateway (verify_jwt delay no deploy),
        // então reprocessa com retry. Outros 4xx são erros definitivos do cliente.
        if (res.status >= 400 && res.status < 500 && res.status !== 401) {
          return { data: errData as T, error: lastError, attempts: attempt };
        }

        if (attempt < maxAttempts) {
          await sleep(baseDelayMs * attempt);
          continue;
        }

        return { data: null, error: lastError, attempts: attempt };
      }

      const data = (await res.json()) as T;
      return { data, error: null, attempts: attempt };

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = { message: msg };
      console.warn(`[invokePublic] ${functionName} tentativa ${attempt}/${maxAttempts} falhou:`, msg);
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
