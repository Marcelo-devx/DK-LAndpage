import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * AuthEventHandler - Gerencia eventos específicos de autenticação
 *
 * Mantemos este componente apenas para tratar PASSWORD_RECOVERY. Evitamos logs
 * e ignoramos eventos como INITIAL_SESSION/TOKEN_REFRESHED para não poluir
 * e nem provocar efeitos colaterais desnecessários ao reconectar a sessão.
 */
const AuthEventHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Só reagir a eventos úteis — não logar tudo para evitar ruído
      if (event === 'PASSWORD_RECOVERY') {
        try {
          navigate('/update-password');
        } catch (error) {
          console.error('[AuthEventHandler] Error handling PASSWORD_RECOVERY:', error);
        }
      }
    });

    const subscription = data?.subscription;
    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        try { subscription.unsubscribe(); } catch (e) { /* ignore */ }
      }
    };
  }, [navigate]);

  return null;
};

export default AuthEventHandler;