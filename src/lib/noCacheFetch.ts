// Small helper to perform fetch without caching for non-Supabase URLs.
// It will delegate untouched to global fetch for Supabase requests to avoid
// interfering with supabase-js header management.

const SUPABASE_HOST = 'jrlozhhvwqfmjtkmvukf.supabase.co';

export async function noCacheFetch(input: RequestInfo | URL, init?: RequestInit) {
  // Normalize URL string for inspection
  let urlString: string;
  if (typeof input === 'string') urlString = input;
  else urlString = String(input);

  // If request targets Supabase host, delegate to default fetch without changes
  try {
    const u = new URL(urlString);
    if (u.host === SUPABASE_HOST) {
      return fetch(input, init);
    }
  } catch (e) {
    // If URL is relative or invalid for URL parsing, fall through and treat as non-supabase
  }

  const safeInit: RequestInit = init ? { ...init } : {};

  // Preserve headers and add cache-control
  const headers = new Headers(safeInit.headers || {});
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  headers.set('Pragma', 'no-cache');

  // For GET requests, append a timestamp param to the URL to bust caches
  let finalInput = input;
  const method = (safeInit.method || 'GET').toUpperCase();
  if (method === 'GET') {
    try {
      const u = new URL(urlString, window.location.origin);
      u.searchParams.set('t', Date.now().toString());
      finalInput = u.toString();
    } catch (e) {
      // ignore URL errors
    }
  }

  return fetch(finalInput, { ...safeInit, cache: 'no-store', headers });
}
