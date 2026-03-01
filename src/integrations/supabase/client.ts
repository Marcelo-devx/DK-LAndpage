import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Por padrão, o Supabase usa localStorage.
    // Alterando para sessionStorage, a sessão do usuário será encerrada
    // automaticamente quando a aba do navegador for fechada.
    storage: sessionStorage,
  },
});