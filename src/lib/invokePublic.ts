import { env } from '@/config/env';

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

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

const requestHeaderVariants: HeadersInit[] = [
  {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  },
  {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  },
];

export async function invokePublic<T = unknown>(
  functionName: string,
  options: PublicInvokeOptions = {}
): Promise<InvokeResult<T>> {
  const { body, maxAttempts = 3, baseDelayMs = 1500 } = options;
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  let lastError: { message: string; context?: unknown } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    for (const headers of requestHeaderVariants) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!res.ok) {
          let errData: unknown = null;
          try {
            errData = await res.json();
          } catch {
            try {
              errData = await res.text();
            } catch {
              errData = null;
            }
          }

          const msg =
            (typeof errData === 'object' && errData !== null && 'error' in errData && typeof (errData as any).error === 'string'
              ? (errData as any).error
              : typeof errData === 'object' && errData !== null && 'message' in errData && typeof (errData as any).message === 'string'
                ? (errData as any).message
                : typeof errData === 'string' && errData.trim()
                  ? errData
                  : `HTTP ${res.status}`);

          lastError = { message: msg, context: errData };

          if (res.status === 401 && headers !== requestHeaderVariants[requestHeaderVariants.length - 1]) {
            continue;
          }

          if (res.status >= 400 && res.status < 500) {
            return { data: errData as T, error: lastError, attempts: attempt };
          }

          if (attempt < maxAttempts) {
            await sleep(baseDelayMs * attempt);
            break;
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
