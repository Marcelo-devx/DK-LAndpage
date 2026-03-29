/**
 * CORS Utilities
 * Controla quais origens podem acessar as Edge Functions
 */

// Whitelist de domínios permitidos (adicionar seus domínios de produção)
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  // Adicione seus domínios de produção aqui:
  // 'https://seudominio.com',
  // 'https://www.seudominio.com',
];

/**
 * Verifica se a origem é permitida
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  // Em desenvolvimento, permite mais origens locais
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    return true;
  }

  // Verifica whitelist
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Gera headers CORS apropriados baseados na origem da requisição
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = isOriginAllowed(origin);

  return {
    'Access-Control-Allow-Origin': allowed ? (origin || '*') : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 horas
  };
}

/**
 * Retorna Response preflight OPTIONS
 */
export function createPreflightResponse(origin: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin)
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
      'Access-Control-Allow-Origin': '*'
    }
  });
}
