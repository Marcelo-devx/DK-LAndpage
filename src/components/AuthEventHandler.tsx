import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AuthEventHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthEventHandler] Auth state changed:', event, session?.user?.id);
      
      // Only handle password recovery and sign out here
      // SIGNED_IN is handled by Login.tsx to avoid redirect conflicts
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/update-password');
      } else if (event === 'SIGNED_OUT') {
        navigate('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return null;
};

export default AuthEventHandler;