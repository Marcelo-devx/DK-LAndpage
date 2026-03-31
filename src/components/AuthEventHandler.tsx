import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AuthEventHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthEventHandler] Auth state changed:', event, session?.user?.id);
      
      // Only handle password recovery and sign out here
      // SIGNED_IN is handled by Login.tsx to avoid redirect conflicts
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/update-password');
      } else if (event === 'SIGNED_OUT') {
        // Navigate to home and force a full reload so any components waiting on
        // auth state are fully reset. This prevents stale state causing
        // infinite loading after logout.
        try {
          navigate('/');
        } catch (e) {
          // ignore navigation error
        }
        // Small timeout to ensure React navigation runs before reload
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
      }
      // INITIAL_SESSION and TOKEN_REFRESHED are now handled in App.tsx
    });

    const subscription = data?.subscription;
    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        try { subscription.unsubscribe(); } catch (e) { console.warn('[AuthEventHandler] failed to unsubscribe', e); }
      }
    };
  }, [navigate]);

  return null;
};

export default AuthEventHandler;