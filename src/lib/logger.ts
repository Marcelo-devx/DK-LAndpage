/**
 * Logger condicional - só mostra logs em desenvolvimento
 *
 * Este logger substitui console.log/console.error para evitar
 * exposição de informações sensíveis em produção (S-08 CORRIGIDO).
 *
 * Uso:
 *   import { logger } from '@/lib/logger';
 *   logger.info('mensagem', data);  // Só mostra em desenvolvimento
 *   logger.error('erro', error);     // Sempre mostra, até em produção
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Log informativo - só em desenvolvimento
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Log de aviso - só em desenvolvimento
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Log de erro - SEMPRE mostra (inclusive em produção)
   * Útil para debug de erros reais em produção
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Log de debug - só em desenvolvimento
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Log genérico - só em desenvolvimento
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log de sucesso (green) - só em desenvolvimento
   */
  success: (...args: any[]) => {
    if (isDevelopment) {
      console.log('%c✅', 'color: green; font-weight: bold', ...args);
    }
  },

  /**
   * Log de informação importante (blue) - só em desenvolvimento
   */
  important: (...args: any[]) => {
    if (isDevelopment) {
      console.log('%cℹ️', 'color: blue; font-weight: bold', ...args);
    }
  },
};

/**
 * Função auxiliar para medir tempo de execução
 * Útil para performance debugging em desenvolvimento
 */
export const timer = () => {
  const start = Date.now();
  return {
    end: (label?: string) => {
      const duration = Date.now() - start;
      if (isDevelopment) {
        console.log(`⏱️ ${label || 'Timer'}: ${duration}ms`);
      }
      return duration;
    },
  };
};

export default logger;
