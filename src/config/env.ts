/**
 * Variáveis de Ambiente da Aplicação
 *
 * IMPORTANTE: Configure estas variáveis no seu ambiente de produção
 * - Vercel: Settings > Environment Variables
 * - Supabase Edge Functions: Project Settings > Environment Variables
 *
 * Para desenvolvimento local, crie um arquivo .env na raiz do projeto
 * baseado no .env.example
 */

const getRequiredEnvVar = (name: string): string => {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(
      `❌ Variável de ambiente ${name} não está configurada.\n` +
      `Verifique seu arquivo .env ou as configurações do ambiente de produção.\n\n` +
      `Para desenvolvimento local:\n` +
      `1. Copie .env.example para .env\n` +
      `2. Preencha as variáveis necessárias\n` +
      `3. Reinicie o servidor de desenvolvimento`
    );
  }
  return value;
};

export const env = {
  // Supabase Configuration
  VITE_SUPABASE_URL: getRequiredEnvVar('VITE_SUPABASE_URL'),
  VITE_SUPABASE_ANON_KEY: getRequiredEnvVar('VITE_SUPABASE_ANON_KEY'),

  // Environment Info
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE,
} as const;

export type Env = typeof env;

// Debug: mostra as variáveis carregadas (apenas em desenvolvimento)
if (env.isDevelopment) {
  console.log('[env] Variáveis de ambiente carregadas:', {
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY.substring(0, 10) + '...',
    isDevelopment: env.isDevelopment,
    isProduction: env.isProduction,
  });
}
