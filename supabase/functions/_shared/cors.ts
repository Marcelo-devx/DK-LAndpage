/**
 * CORS Utilities
 * Controla quais origens podem acessar as Edge Functions.
 */

const ALLOWED_ORIGINS = [
  'https://www.dkcwb.com',
  'https://dkcwb.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  if (
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.startsWith('https://localhost') ||
    origin.startsWith('https://127.0.0.1')
  ) {
    return true;
  }

  // Também verifica variável de ambiente ALLOWED_ORIGINS
  // @ts-ignore
  const envVar = (typeof Deno !== 'undefined' ? Deno.env.get('ALLOWED_ORIGINS') : undefined) || '';
  const fromEnv = envVar.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);

  return [...ALLOWED_ORIGINS, ...fromEnv].includes(origin);
}

/**
 * Gera headers CORS. Se a origem for permitida, retorna ela.
 * Caso contrário, usa '*' para não quebrar o preflight (o browser ainda bloqueará
 * requisições com credenciais, mas o preflight passará).
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isOriginAllowed(origin) ? (origin as string) : '*';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Retorna Response preflight OPTIONS com status 200 (garantido OK)
 */
export function createPreflightResponse(origin: string | null): Response {
  return new Response(null, {
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
