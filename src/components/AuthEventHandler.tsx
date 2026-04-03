import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AuthEventHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthEventHandler] Auth state changed:', event, session?.user?.id);
      
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/update-password');
      } else if (event === 'SIGNED_OUT') {
        navigate('/');
      }
      // TOKEN_REFRESHED, INITIAL_SESSION, SIGNED_IN — não fazem nada aqui
      // para evitar re-renders ou reloads desnecessários ao voltar de outra aba
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