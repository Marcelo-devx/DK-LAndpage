/**
 * CORS Utilities
 * Controla quais origens podem acessar as Edge Functions.
 */

const ALLOWED_ORIGINS = [
  'https://www.dkcwb.com',
  'https://dkcwb.com',
];

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // sem origin = server-to-server, permite

  // Qualquer localhost ou 127.0.0.1 em qualquer porta é permitido (dev)
  if (
    origin.startsWith('http://localhost') ||
    origin.startsWith('https://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.startsWith('https://127.0.0.1')
  ) {
    return true;
  }

  // Variável de ambiente ALLOWED_ORIGINS (opcional)
  // @ts-ignore
  const envVar = (typeof Deno !== 'undefined' ? Deno.env.get('ALLOWED_ORIGINS') : undefined) || '';
  const fromEnv = envVar.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);

  return [...ALLOWED_ORIGINS, ...fromEnv].includes(origin);
}

/**
 * Gera headers CORS. Se a origem for permitida, retorna ela.
 * Caso contrário, usa '*'.
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isOriginAllowed(origin) ? (origin ?? '*') : '*';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Retorna Response preflight OPTIONS — DEVE ter status 200 e body não-nulo
 * para passar na verificação do browser.
 */
export function createPreflightResponse(origin: string | null): Response {
  return new Response('ok', {
    status: 200,
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
