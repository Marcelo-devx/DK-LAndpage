/**
 * CORS Utilities — wildcard para compatibilidade máxima com browser e n8n
 * redeploy: 2026-04-23T22:15:00Z
 */

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-token, x-requested-with, accept, origin',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export function getCorsHeaders(_origin: string | null): Record<string, string> {
  return CORS_HEADERS;
}

export function isOriginAllowed(_origin: string | null): boolean {
  return true;
}

export function createPreflightResponse(_origin: string | null): Response {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export function createCorsErrorResponse(message: string = 'Origin not allowed'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
