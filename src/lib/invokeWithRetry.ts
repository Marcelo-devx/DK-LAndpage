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
          const delay = baseDelayMs * attempt;
          await sleep(delay);
          continue;
        }

        return { data: null, error: lastError, attempts: attempt };
      }

      // Erro HTTP que pode ser cold start (400/500 com body vazio ou mensagem genérica) — retenta
      if (error && isColdStartHttpError(error)) {
        lastError = { message: error.message || 'HTTP cold start error', context: error };
        console.warn(
          `[invokeWithRetry] ${functionName} tentativa ${attempt}/${maxAttempts} falhou (cold start HTTP):`,
          error
        );

        if (attempt < maxAttempts) {
          const delay = baseDelayMs * attempt;
          await sleep(delay);
          continue;
        }

        return { data: null, error: lastError, attempts: attempt };
      }

      // Erro de negócio real (ex: token inválido, pedido não encontrado) — retorna imediatamente
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

// Detecta erros HTTP que indicam cold start (body vazio, mensagem genérica de servidor)
function isColdStartHttpError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  const name = String(e.name || '');
  const msg = String(e.message || '').toLowerCase();
  const status = Number((e as any).status || (e as any).statusCode || 0);

  if (name !== 'FunctionsHttpError') return false;

  // 500 sempre retenta (erro interno do servidor / cold start)
  if (status === 500) return true;

  // 400 com mensagem vazia ou genérica indica cold start (body não chegou)
  // NÃO retentar se a mensagem indica erro de negócio real (ex: order_id missing)
  if (status === 400) {
    if (
      msg.includes('order_id') ||
      msg.includes('required') ||
      msg.includes('invalid') ||
      msg.includes('not found')
    ) {
      return false;
    }
    return (
      msg === '' ||
      msg === 'bad request' ||
      msg.includes('non-2xx status code') ||
      msg.includes('edge function returned a non-2xx')
    );
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}