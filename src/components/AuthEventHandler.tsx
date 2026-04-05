import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AuthEventHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthEventHandler] Auth state changed:', event, session?.user?.id);
      
      try {
        if (event === 'PASSWORD_RECOVERY') {
          navigate('/update-password');
        }
        // SIGNED_OUT removido - o componente que iniciou o logout cuida da navegação
        // para evitar conflitos de navegação múltipla
        // TOKEN_REFRESHED, INITIAL_SESSION, SIGNED_IN — não fazem nada aqui
        // para evitar re-renders ou reloads desnecessários ao voltar de outra aba
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