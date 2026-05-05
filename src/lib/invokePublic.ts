/**
 * Chama uma edge function pública via fetch direto.
 *
 * Envia APENAS o header `apikey` (sem Authorization).
 * O gateway do Supabase aceita requisições com apikey mesmo quando
 * verify_jwt=true — o 401 só ocorre quando o Authorization header
 * contém um JWT inválido/sem sub. Omitindo o Authorization, o gateway
 * trata como requisição anônima e passa para a função.
 */

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
          // Só apikey — sem Authorization.
          // Com Authorization: Bearer <anon_key>, o gateway rejeita com 401
          // porque o anon key não tem `sub` (não é um usuário).
          // Sem Authorization, o gateway passa a requisição para a função
          // que tem verify_jwt=false no config.toml.
          'apikey': SUPABASE_ANON_KEY,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        let errData: unknown = null;
        try { errData = await res.json(); } catch { /* ignore */ }
        const msg = (errData as any)?.error || (errData as any)?.message || `HTTP ${res.status}`;
        lastError = { message: msg, context: errData };

        // 4xx não retenta (erro de negócio ou auth)
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

  return { data: null, error: lastError ?? { message: 'Erro desconhecido' }, attempts: maxAttempts };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
