/**
 * Chama uma edge function pública via fetch direto.
 * Envia o anon key tanto no header apikey quanto no Authorization,
 * o que satisfaz o verify_jwt do Supabase (anon key é um JWT válido).
 */

const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          // Passa o anon key como Bearer — é um JWT válido (role: anon)
          // e satisfaz o verify_jwt do Supabase sem exigir usuário logado
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        let errData: unknown = null;
        try { errData = await res.json(); } catch { /* ignore */ }
        const msg = (errData as any)?.error || `HTTP ${res.status}`;
        lastError = { message: msg, context: errData };

        // 4xx não retenta (erro de negócio)
        if (res.status >= 400 && res.status < 500) {
          return { data: errData as T, error: lastError, attempts: attempt };
        }

        // 5xx retenta
        if (attempt < maxAttempts) {
          await sleep(baseDelayMs * attempt);
          continue;
        }
        return { data: null, error: lastError, attempts: attempt };
      }

      const data = await res.json() as T;
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