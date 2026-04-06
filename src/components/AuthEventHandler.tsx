import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * AuthEventHandler - Gerencia eventos específicos de autenticação
 * 
 * O AuthContext centralizado gerencia o estado de autenticação principal (session, user, profile).
 * Este componente gerencia apenas eventos específicos que não são cobertos pelo AuthContext:
 * - PASSWORD_RECOVERY: redireciona para a página de atualização de senha
 * 
 * Eventos gerenciados pelo AuthContext:
 * - SIGNED_IN, SIGNED_OUT, USER_UPDATED, TOKEN_REFRESHED, INITIAL_SESSION
 */
const AuthEventHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthEventHandler] Auth state changed:', event, session?.user?.id);
      
      try {
        // Apenas PASSWORD_RECOVERY precisa de tratamento específico aqui
        // Todos os outros eventos são gerenciados pelo AuthContext
        if (event === 'PASSWORD_RECOVERY') {
          navigate('/update-password');
        }
      } catch (error) {
        // Captura erros que possam ocorrer durante a navegação
        console.error('[AuthEventHandler] Error handling auth event:', error);
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