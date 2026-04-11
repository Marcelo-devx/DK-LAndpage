/**
 * CORS Utilities
 * Controla quais origens podem acessar as Edge Functions.
 *
 * Configuração via variável de ambiente ALLOWED_ORIGINS (no Supabase Secrets):
 *   - Separe múltiplos domínios por vírgula.
 *   - Exemplo: https://www.dkcwb.com,https://dkcwb.com
 *
 * Fallback: localhost e 127.0.0.1 são sempre permitidos para desenvolvimento.
 */

function getAllowedOrigins(): string[] {
  // @ts-ignore
  const envVar = (typeof Deno !== 'undefined' ? Deno.env.get('ALLOWED_ORIGINS') : undefined) || '';

  const fromEnv = envVar
    .split(',')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);

  // Defaults de desenvolvimento (sempre permitidos)
  const devDefaults = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ];

  // Adicionar domínios de produção como fallback imediato para evitar necessidade
  // de configurar a env var imediatamente. Recomenda-se ainda definir ALLOWED_ORIGINS
  // via painel do Supabase para controle em produção.
  const productionDefaults = [
    'https://www.dkcwb.com',
    'https://dkcwb.com',
  ];

  return [...devDefaults, ...productionDefaults, ...fromEnv];
}

/**
 * Verifica se a origem é permitida
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  // Sempre permite localhost / 127.0.0.1 para desenvolvimento
  if (
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1')
  ) {
    return true;
  }

  const allowed = getAllowedOrigins();
  return allowed.includes(origin);
}

/**
 * Gera headers CORS apropriados baseados na origem da requisição.
 * Se a origem for permitida, retorna ela explicitamente.
 * Se não for permitida, retorna header vazio (browser bloqueará).
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = isOriginAllowed(origin);

  return {
    'Access-Control-Allow-Origin': allowed ? (origin as string) : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 horas
  };
}

/**
 * Retorna Response preflight OPTIONS
 */
export function createPreflightResponse(origin: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

/**
 * Retorna Response com erro CORS
 */
export function createCorsErrorResponse(message: string = 'Origin not allowed'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}