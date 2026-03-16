import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AuthEventHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthEventHandler] Auth state changed:', event, session?.user?.id);
      
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/update-password');
      } else if (event === 'SIGNED_OUT') {
        // Redirect to home on logout
        navigate('/');
      } else if (event === 'SIGNED_IN') {
        // Check if profile is complete after signing in
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, cpf_cnpj, gender, date_of_birth, cep, street, number, neighborhood, city, state')
          .eq('id', session.user.id)
          .single();

        const isProfileComplete = profile && 
          profile.first_name && 
          profile.last_name && 
          profile.phone && 
          profile.cpf_cnpj &&
          profile.gender &&
          profile.date_of_birth &&
          profile.cep &&
          profile.street &&
          profile.number &&
          profile.neighborhood &&
          profile.city &&
          profile.state;

        if (!isProfileComplete && window.location.pathname !== '/complete-profile') {
          navigate('/complete-profile', { replace: true });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return null;
};

export default AuthEventHandler;