import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

// Custom fetch that disables cache
const customFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers: {
      ...options?.headers,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
  return response;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: customFetch,
  },
});